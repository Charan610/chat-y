"""Provider router with automatic failover — the most critical subsystem.

Manages a ranked chain of providers with health tracking, automatic failover
on errors/timeouts, and context replay when switching providers mid-task.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncGenerator


from codey.agent.message_types import Message, StreamDelta, ToolSchema
from codey.config.schema import CodeYConfig, ProviderConfig
from codey.providers.base import Provider
from codey.providers.gemini_provider import GeminiProvider
from codey.providers.groq_provider import GroqProvider
from codey.providers.local_provider import LocalProvider
from codey.providers.nim_provider import NIMProvider
from codey.telemetry.event_bus import EventBus, Events

logger = logging.getLogger(__name__)

# Health tracking window size
HEALTH_WINDOW = 20  # Track last N requests per provider
COOLDOWN_SECONDS = 60  # Seconds to wait before retrying a failed provider


class AllProvidersExhaustedError(Exception):
    """Raised when all providers in the chain have failed."""

    pass


class ProviderHealth:
    """Rolling health metrics for a single provider."""

    def __init__(self) -> None:
        self.errors: deque[float] = deque(maxlen=HEALTH_WINDOW)
        self.latencies: deque[float] = deque(maxlen=HEALTH_WINDOW)
        self.successes: deque[float] = deque(maxlen=HEALTH_WINDOW)
        self.last_failure: float | None = None
        self.last_failure_reason: str | None = None
        self.total_requests: int = 0
        self.total_failures: int = 0

    def record_success(self, latency: float) -> None:
        self.latencies.append(latency)
        self.successes.append(time.time())
        self.total_requests += 1

    def record_failure(self, reason: str) -> None:
        self.errors.append(time.time())
        self.last_failure = time.time()
        self.last_failure_reason = reason
        self.total_requests += 1
        self.total_failures += 1

    @property
    def error_rate(self) -> float:
        """Rolling error rate (0.0 - 1.0)."""
        total = len(self.errors) + len(self.successes)
        if total == 0:
            return 0.0
        return len(self.errors) / total

    @property
    def p50_latency(self) -> float:
        """Median latency in seconds."""
        if not self.latencies:
            return 0.0
        sorted_lats = sorted(self.latencies)
        mid = len(sorted_lats) // 2
        return sorted_lats[mid]

    @property
    def health_score(self) -> float:
        """Combined health score (lower is better).

        Weighted: error_rate * 0.7 + normalized_latency * 0.3
        """
        # Normalize latency to 0-1 range (assuming 30s is worst case)
        norm_latency = min(self.p50_latency / 30.0, 1.0)
        return self.error_rate * 0.7 + norm_latency * 0.3

    def is_in_cooldown(self) -> bool:
        """Check if provider is in cooldown period after a failure."""
        if self.last_failure is None:
            return False
        return (time.time() - self.last_failure) < COOLDOWN_SECONDS

    def to_dict(self) -> dict[str, Any]:
        """Serialize for health persistence."""
        return {
            "error_rate": self.error_rate,
            "p50_latency": self.p50_latency,
            "total_requests": self.total_requests,
            "total_failures": self.total_failures,
            "last_failure": self.last_failure,
            "last_failure_reason": self.last_failure_reason,
        }


# ── Provider factory ──

PROVIDER_CLASSES: dict[str, type[Provider]] = {
    "nim": NIMProvider,
    "groq": GroqProvider,
    "gemini": GeminiProvider,
    "local": LocalProvider,
}


def _create_provider(
    provider_name: str,
    model_alias: str,
    model_id: str,
    config: ProviderConfig,
) -> Provider:
    """Create a provider instance by name."""
    cls = PROVIDER_CLASSES.get(provider_name)
    if cls is None:
        # Default to NIM (OpenAI-compatible) for unknown providers
        logger.warning(
            "Unknown provider '%s', falling back to NIM-style OpenAI-compatible",
            provider_name,
        )
        cls = NIMProvider
    return cls(model_alias=model_alias, model_id=model_id, config=config)


class ProviderRouter:
    """Manages provider chain with automatic failover.

    Key behaviors:
      - Tries providers in chain order, respecting health scores
      - On failure (timeout, 429, 5xx, malformed response): advances to next
      - Full context replay on failover — never drops conversation history
      - Emits PROVIDER_FAILOVER events for UI banners
      - Manual override via set_override()
      - Dynamic reordering based on rolling health metrics
    """

    def __init__(
        self,
        config: CodeYConfig,
        event_bus: EventBus,
        chain_name: str = "default",
    ) -> None:
        self.config = config
        self.event_bus = event_bus

        # Resolve the chain
        if chain_name == "large_context" and config.routing.large_context_chain:
            chain_aliases = config.routing.large_context_chain
        else:
            chain_aliases = config.routing.default_chain

        # Build provider instances
        self.chain: list[Provider] = []
        self.health: dict[str, ProviderHealth] = {}

        for alias in chain_aliases:
            try:
                model_id, provider_config = config.resolve_model(alias)
                provider_name = config.resolve_provider_for_alias(alias)
                provider = _create_provider(provider_name, alias, model_id, provider_config)
                self.chain.append(provider)
                self.health[alias] = ProviderHealth()
            except KeyError as e:
                logger.warning("Skipping unconfigured model alias '%s': %s", alias, e)

        if not self.chain:
            raise ValueError("No valid providers configured in the routing chain.")

        self.active_index: int = 0
        self.manual_override: str | None = None
        self.timeout = config.routing.timeout_seconds
        self.max_retries = config.routing.max_retries_per_provider

        logger.info(
            "Router initialized: chain=%s, timeout=%ds",
            [p.model_alias for p in self.chain],
            self.timeout,
        )

    @property
    def active_provider(self) -> Provider:
        """Currently active provider."""
        if self.manual_override:
            for p in self.chain:
                if p.model_alias == self.manual_override:
                    return p
        return self.chain[self.active_index]

    def set_override(self, model_alias: str) -> bool:
        """Force a specific provider for the rest of the session.

        Returns True if the alias was found in the chain.
        """
        for p in self.chain:
            if p.model_alias == model_alias:
                self.manual_override = model_alias
                logger.info("Manual override set: %s", model_alias)
                return True
        logger.warning("Override alias '%s' not found in chain", model_alias)
        return False

    def clear_override(self) -> None:
        """Clear manual provider override."""
        self.manual_override = None

    async def complete(
        self,
        messages: list[Message],
        tools: list[ToolSchema] | None = None,
    ) -> Message:
        """Route a completion request with automatic failover.

        Tries each provider in the chain (respecting health and cooldowns).
        On failure, advances to the next provider and replays full context.
        """
        errors: list[str] = []

        # Build the order of providers to try
        providers_to_try = self._get_provider_order()

        for provider in providers_to_try:
            alias = provider.model_alias
            health = self.health.get(alias, ProviderHealth())

            # Skip providers in cooldown (unless it's the last resort)
            if health.is_in_cooldown() and provider != providers_to_try[-1]:
                logger.debug("Skipping %s (in cooldown)", alias)
                continue

            for attempt in range(self.max_retries + 1):
                start_time = time.time()
                try:
                    response = await asyncio.wait_for(
                        provider.complete(messages, tools),
                        timeout=self.timeout,
                    )

                    # Validate response
                    if not self._is_valid_response(response):
                        raise ValueError("Malformed response: empty content and no tool calls")

                    # Record success
                    latency = time.time() - start_time
                    health.record_success(latency)
                    return response

                except asyncio.TimeoutError:
                    elapsed = time.time() - start_time
                    reason = f"timed out after {elapsed:.1f}s"
                    health.record_failure(reason)
                    errors.append(f"{provider.display_name()}: {reason}")
                    logger.warning("Provider %s %s", alias, reason)

                except Exception as e:
                    elapsed = time.time() - start_time
                    reason = self._classify_error(e)

                    if not self._is_failover_worthy(e):
                        # Content-level error — don't failover
                        health.record_success(elapsed)
                        raise

                    health.record_failure(reason)
                    errors.append(f"{provider.display_name()}: {reason}")
                    logger.warning("Provider %s error: %s", alias, reason)

            # All retries exhausted for this provider — emit failover event
            next_provider = self._get_next_available(providers_to_try, provider)
            if next_provider:
                self.event_bus.emit(
                    Events.PROVIDER_FAILOVER,
                    from_provider=provider.display_name(),
                    to_provider=next_provider.display_name(),
                    reason=errors[-1] if errors else "unknown",
                    elapsed=time.time() - start_time,
                )
                logger.info(
                    "Failover: %s → %s (%s)",
                    provider.display_name(),
                    next_provider.display_name(),
                    errors[-1] if errors else "unknown",
                )

        # All providers exhausted
        error_summary = "; ".join(errors)
        raise AllProvidersExhaustedError(
            f"All providers failed: {error_summary}"
        )

    async def stream(
        self,
        messages: list[Message],
        tools: list[ToolSchema] | None = None,
    ) -> AsyncGenerator[StreamDelta, None]:
        """Route a streaming request with failover.

        Falls back to non-streaming on the failover provider if streaming fails.
        """
        providers_to_try = self._get_provider_order()

        for provider in providers_to_try:
            alias = provider.model_alias
            health = self.health.get(alias, ProviderHealth())

            if health.is_in_cooldown() and provider != providers_to_try[-1]:
                continue

            start_time = time.time()
            try:
                async for delta in provider.stream(messages, tools):
                    yield delta
                # If we get here, streaming completed successfully
                latency = time.time() - start_time
                health.record_success(latency)
                return

            except Exception as e:
                elapsed = time.time() - start_time
                reason = self._classify_error(e)

                if not self._is_failover_worthy(e):
                    raise

                health.record_failure(reason)
                logger.warning("Stream failover from %s: %s", alias, reason)

                next_provider = self._get_next_available(providers_to_try, provider)
                if next_provider:
                    self.event_bus.emit(
                        Events.PROVIDER_FAILOVER,
                        from_provider=provider.display_name(),
                        to_provider=next_provider.display_name(),
                        reason=reason,
                        elapsed=elapsed,
                    )
                continue

        raise AllProvidersExhaustedError("All providers failed during streaming")

    def _get_provider_order(self) -> list[Provider]:
        """Get ordered list of providers, considering manual override and health."""
        if self.manual_override:
            # Put overridden provider first, keep rest as fallback
            override_provider = None
            rest = []
            for p in self.chain:
                if p.model_alias == self.manual_override:
                    override_provider = p
                else:
                    rest.append(p)
            if override_provider:
                return [override_provider] + rest
            return self.chain

        # Sort by health score (lower is better), preserving original order for ties
        scored = []
        for i, p in enumerate(self.chain):
            health = self.health.get(p.model_alias, ProviderHealth())
            scored.append((health.health_score, i, p))

        scored.sort(key=lambda x: (x[0], x[1]))
        return [p for _, _, p in scored]

    def _get_next_available(
        self, providers: list[Provider], current: Provider
    ) -> Provider | None:
        """Get the next provider after current in the list."""
        found_current = False
        for p in providers:
            if p == current:
                found_current = True
                continue
            if found_current:
                return p
        return None

    @staticmethod
    def _is_valid_response(response: Message) -> bool:
        """Check if a response is valid (has content or tool calls)."""
        return bool(response.content) or bool(response.tool_calls)

    @staticmethod
    def _is_failover_worthy(error: Exception) -> bool:
        """Determine if an error should trigger failover.

        Failover on: connection errors, timeouts, HTTP 429, HTTP 5xx, malformed responses.
        Do NOT failover on: content-level issues, auth errors (user needs to fix config).
        """
        error_str = str(error).lower()

        # Connection errors
        if isinstance(error, (ConnectionError, OSError)):
            return True
        if isinstance(error, asyncio.TimeoutError):
            return True

        # HTTP status errors
        if "429" in error_str or "rate limit" in error_str:
            return True
        if any(f"{code}" in error_str for code in range(500, 600)):
            return True
        if "timeout" in error_str:
            return True
        if "connection" in error_str or "connect" in error_str:
            return True

        # Malformed response
        if isinstance(error, ValueError) and "malformed" in error_str:
            return True

        # Auth errors — don't failover (user needs to fix config)
        if "401" in error_str or "403" in error_str or "unauthorized" in error_str:
            return False

        # Default: failover on unknown errors (safer)
        return True

    @staticmethod
    def _classify_error(error: Exception) -> str:
        """Generate a human-readable error classification."""
        error_str = str(error).lower()

        if isinstance(error, asyncio.TimeoutError) or "timeout" in error_str:
            return "request timed out"
        if "429" in error_str or "rate limit" in error_str:
            return "rate limited (429)"
        if "404" in error_str or "not found" in error_str:
            return "model/endpoint not found (404)"
        if "500" in error_str:
            return "server error (500)"
        if "502" in error_str:
            return "bad gateway (502)"
        if "503" in error_str:
            return "service unavailable (503)"
        if "connection" in error_str:
            return "connection failed"
        if "401" in error_str or "unauthorized" in error_str:
            return "authentication failed (401)"

        return f"{type(error).__name__}: {str(error)[:100]}"

    def get_health_summary(self) -> dict[str, Any]:
        """Get health summary for all providers (for /context command and persistence)."""
        summary = {}
        for p in self.chain:
            health = self.health.get(p.model_alias, ProviderHealth())
            summary[p.model_alias] = {
                "provider": p.name,
                "model": p.model_id,
                "active": p == self.active_provider,
                **health.to_dict(),
            }
        return summary

    def save_health(self, path: Path | None = None) -> None:
        """Persist health data to disk."""
        if path is None:
            path = Path.home() / ".codey" / "provider_health.json"

        path.parent.mkdir(parents=True, exist_ok=True)
        data = self.get_health_summary()
        path.write_text(json.dumps(data, indent=2, default=str))
        logger.debug("Health data saved to %s", path)
