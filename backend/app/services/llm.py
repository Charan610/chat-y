import os
import time
import logging
from typing import AsyncGenerator, Optional, Dict, List, Any
import litellm
from litellm import acompletion

logger = logging.getLogger(__name__)

# Pricing fallback table (per 1M tokens)
FALLBACK_PRICING = {
    "groq/llama-3.3-70b-versatile": {"input": 0.59, "output": 0.79},
    "groq/llama-3.2-3b-preview": {"input": 0.06, "output": 0.06},
    "groq/mixtral-8x7b-32768": {"input": 0.24, "output": 0.24},
    "groq/gemma2-9b-it": {"input": 0.20, "output": 0.20},
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "o1": {"input": 15.00, "output": 60.00},
    "o1-mini": {"input": 3.00, "output": 12.00},
    "claude-3-5-sonnet-20241022": {"input": 3.00, "output": 15.00},
    "claude-3-5-haiku-20241022": {"input": 0.80, "output": 4.00},
    "gemini/gemini-1.5-pro": {"input": 3.50, "output": 10.50},
    "gemini/gemini-1.5-flash": {"input": 0.35, "output": 1.05},
}


class LLMService:
    def __init__(self):
        litellm.drop_params = True
        litellm.set_verbose = False

    def build_litellm_model_string(self, provider: str, model_id: str) -> str:
        """Maps provider+model_id to litellm model string format."""
        if provider == "groq":
            return f"groq/{model_id}"
        elif provider == "nvidia_nim":
            return f"nvidia_nim/{model_id}"
        elif provider == "openai":
            return model_id
        elif provider == "anthropic":
            return model_id
        elif provider == "google":
            # model_id already has gemini/ prefix
            return model_id
        elif provider == "openrouter":
            return f"openrouter/{model_id}"
        elif provider == "ollama":
            return f"ollama/{model_id}"
        else:
            return model_id

    def _normalize_provider(self, p: str) -> str:
        clean = p.lower().strip()
        if clean in ("nvidia", "nvidia_nim", "nim"):
            return "nvidia_nim"
        if clean in ("google", "gemini"):
            return "google"
        if clean in ("anthropic", "claude"):
            return "anthropic"
        return clean

    def _parse_provider_from_model(self, model: str) -> str:
        """Extract provider from model string."""
        if "/" in model:
            return self._normalize_provider(model.split("/")[0])
        if model.startswith(("gpt-", "o1", "o3", "chatgpt")):
            return "openai"
        if model.startswith("claude-"):
            return "anthropic"
        if model.startswith("gemini"):
            return "google"
        return "openai"

    def set_api_keys_for_request(self, provider: str, api_key: str, base_url: Optional[str] = None):
        """Set environment variables for litellm to use per provider."""
        norm = self._normalize_provider(provider)
        if norm == "groq":
            os.environ["GROQ_API_KEY"] = api_key
        elif norm == "nvidia_nim":
            os.environ["NVIDIA_NIM_API_KEY"] = api_key
            if base_url:
                os.environ["NVIDIA_NIM_API_BASE"] = base_url
        elif norm == "openai":
            os.environ["OPENAI_API_KEY"] = api_key
            if base_url:
                os.environ["OPENAI_BASE_URL"] = base_url
        elif norm == "anthropic":
            os.environ["ANTHROPIC_API_KEY"] = api_key
        elif norm == "google":
            os.environ["GEMINI_API_KEY"] = api_key
            os.environ["GOOGLE_API_KEY"] = api_key
        elif norm == "openrouter":
            os.environ["OPENROUTER_API_KEY"] = api_key
        elif norm == "ollama":
            if base_url:
                os.environ["OLLAMA_API_BASE"] = base_url

    def estimate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        """Estimate cost using litellm or fallback pricing table."""
        try:
            cost = litellm.completion_cost(
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
            )
            return round(cost, 8)
        except Exception:
            # Use fallback pricing
            pricing = FALLBACK_PRICING.get(model, {"input": 1.0, "output": 1.0})
            input_cost = (prompt_tokens / 1_000_000) * pricing["input"]
            output_cost = (completion_tokens / 1_000_000) * pricing["output"]
            return round(input_cost + output_cost, 8)

    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        model: str,
        api_keys: Dict[str, Any],
        options: Dict[str, Any]
    ) -> AsyncGenerator[Dict, None]:
        """Stream chat completion. Yields dict chunks."""
        start_time = time.time()
        full_content = ""
        prompt_tokens = 0
        completion_tokens = 0
        reasoning_content = ""

        try:
            # Determine provider and set API keys
            provider = self._parse_provider_from_model(model)
            key_info = api_keys.get(provider) or api_keys.get(self._normalize_provider(provider))
            if not key_info:
                # check aliases
                for k, v in api_keys.items():
                    if self._normalize_provider(k) == provider:
                        key_info = v
                        break
            if key_info:
                self.set_api_keys_for_request(provider, key_info["api_key"], key_info.get("base_url"))

            # Build extra kwargs
            extra_kwargs = {}
            reasoning_mode = options.get("reasoning_mode", False)

            if reasoning_mode and provider == "nvidia_nim":
                extra_kwargs["extra_body"] = {"reasoning_budget": -1}

            temperature = options.get("temperature", 0.7)
            max_tokens = options.get("max_tokens", 4096)

            # Some models don't support temperature
            o1_models = {"o1", "o1-mini", "o1-preview", "o3", "o3-mini"}
            model_name = model.split("/")[-1] if "/" in model else model
            if model_name in o1_models:
                temperature = 1  # o1 models require temperature=1

            response = await acompletion(
                model=model,
                messages=messages,
                stream=True,
                temperature=temperature,
                max_tokens=max_tokens,
                **extra_kwargs,
            )

            async for chunk in response:
                if hasattr(chunk, "choices") and chunk.choices:
                    choice = chunk.choices[0]
                    delta = choice.delta if hasattr(choice, "delta") else None

                    if delta:
                        # Handle reasoning content (for models that support it)
                        if hasattr(delta, "reasoning_content") and delta.reasoning_content:
                            reasoning_content += delta.reasoning_content
                            yield {"type": "reasoning", "content": delta.reasoning_content}

                        # Handle regular content
                        if hasattr(delta, "content") and delta.content:
                            full_content += delta.content
                            yield {"type": "content", "content": delta.content}

                # Collect usage
                if hasattr(chunk, "usage") and chunk.usage:
                    prompt_tokens = chunk.usage.prompt_tokens or 0
                    completion_tokens = chunk.usage.completion_tokens or 0

            latency_ms = int((time.time() - start_time) * 1000)
            total_tokens = prompt_tokens + completion_tokens
            estimated_cost = self.estimate_cost(model, prompt_tokens, completion_tokens)

            yield {
                "type": "metadata",
                "model": model,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "latency_ms": latency_ms,
                "estimated_cost": estimated_cost,
            }

        except Exception as e:
            logger.error(f"LLM stream error: {e}")
            yield {"type": "error", "content": str(e)}
            return

        yield {"type": "done"}
