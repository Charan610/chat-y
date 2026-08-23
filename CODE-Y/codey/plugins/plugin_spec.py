"""Plugin specification — defines the contract for CODE-Y plugins.

A plugin is a directory in ~/.codey/plugins/<name>/ containing:
  - plugin.yaml: manifest with name, version, description, entrypoint
  - A Python module that exports register(registry, config)
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, Field

from codey.config.schema import CodeYConfig
from codey.tools.registry import ToolRegistry


class PluginManifest(BaseModel):
    """Plugin manifest loaded from plugin.yaml."""

    name: str
    version: str = "0.1.0"
    description: str = ""
    entrypoint: str = Field(
        default="main",
        description="Python module name (relative to plugin dir) that exports register().",
    )
    system_prompt_fragment: str | None = Field(
        default=None,
        description="Optional text appended to the system prompt when this plugin is active.",
    )


@runtime_checkable
class PluginInterface(Protocol):
    """Protocol that plugin entrypoint modules must implement."""

    def register(self, registry: ToolRegistry, config: CodeYConfig) -> None:
        """Register tools, slash commands, or other extensions.

        Args:
            registry: The shared tool registry to add tools to.
            config: The current CODE-Y configuration.
        """
        ...
