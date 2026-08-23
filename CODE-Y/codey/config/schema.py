"""Pydantic v2 models for CODE-Y configuration validation."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ProviderConfig(BaseModel):
    """Configuration for a single LLM provider."""

    api_key_env: str | None = Field(
        default=None,
        description="Environment variable name holding the API key.",
    )
    base_url: str | None = Field(
        default=None,
        description="Base URL for the provider's API endpoint.",
    )
    models: dict[str, str] = Field(
        default_factory=dict,
        description="Mapping of alias -> actual model ID. E.g. nim_deepseek_v4 -> deepseek-ai/deepseek-v4",
    )


class RoutingConfig(BaseModel):
    """Failover routing configuration."""

    default_chain: list[str] = Field(
        default_factory=lambda: ["nim_deepseek_v4"],
        description="Ordered list of model aliases to try for default tasks.",
    )
    large_context_chain: list[str] = Field(
        default_factory=list,
        description="Ordered list of model aliases for large-context tasks.",
    )
    timeout_seconds: int = Field(
        default=25,
        description="Timeout in seconds before failing over to the next provider.",
    )
    max_retries_per_provider: int = Field(
        default=1,
        description="Max retries per provider before advancing in the chain.",
    )


class PermissionsConfig(BaseModel):
    """Permissions for tool execution."""

    auto_approve_reads: bool = Field(
        default=True,
        description="Automatically approve file read operations.",
    )
    auto_approve_writes: bool = Field(
        default=False,
        description="Automatically approve file write operations.",
    )
    auto_approve_shell: bool = Field(
        default=False,
        description="Automatically approve shell command execution.",
    )
    shell_allowlist: list[str] = Field(
        default_factory=lambda: ["git", "pytest", "npm", "pip", "ls", "cat", "find", "grep"],
        description="Shell commands that are auto-approved when auto_approve_shell is False.",
    )


class UIConfig(BaseModel):
    """UI appearance configuration."""

    theme: str = Field(default="phosphor_amber")
    verbose_default: bool = Field(
        default=False,
        description="Whether to show raw reasoning tokens by default.",
    )


class CodeYConfig(BaseModel):
    """Root configuration model for CODE-Y."""

    providers: dict[str, ProviderConfig] = Field(default_factory=dict)
    routing: RoutingConfig = Field(default_factory=RoutingConfig)
    permissions: PermissionsConfig = Field(default_factory=PermissionsConfig)
    ui: UIConfig = Field(default_factory=UIConfig)

    def resolve_model(self, alias: str) -> tuple[str, ProviderConfig]:
        """Resolve a model alias to (actual_model_id, provider_config).

        Searches all providers for the alias. Returns the first match.

        Raises:
            KeyError: If the alias is not found in any provider.
        """
        for provider_name, provider_cfg in self.providers.items():
            if alias in provider_cfg.models:
                return provider_cfg.models[alias], provider_cfg
        raise KeyError(
            f"Model alias '{alias}' not found in any provider. "
            f"Available aliases: {self._all_aliases()}"
        )

    def resolve_provider_for_alias(self, alias: str) -> str:
        """Return the provider name that owns a given model alias."""
        for provider_name, provider_cfg in self.providers.items():
            if alias in provider_cfg.models:
                return provider_name
        raise KeyError(f"Model alias '{alias}' not found in any provider.")

    def _all_aliases(self) -> list[str]:
        aliases = []
        for provider_cfg in self.providers.values():
            aliases.extend(provider_cfg.models.keys())
        return aliases
