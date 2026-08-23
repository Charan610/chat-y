"""Abstract base class for CODE-Y tools.

All tools — native (filesystem, shell, git) and MCP-discovered — implement
this interface and register with the ToolRegistry.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class Tool(ABC):
    """Base class for agent tools.

    Attributes:
        name: Unique tool identifier (e.g., "read_file").
        description: Human-readable description for the model.
        parameters: JSON Schema dict describing the tool's parameters.
        requires_confirmation: If True, the agent loop must get user approval
            before executing this tool.
    """

    name: str
    description: str
    parameters: dict[str, Any]
    requires_confirmation: bool = False

    @abstractmethod
    async def execute(self, **kwargs: Any) -> str:
        """Execute the tool with the given arguments.

        Returns a string result that will be sent back to the model as
        a tool response message.
        """
        ...

    def get_schema(self) -> dict[str, Any]:
        """Return an OpenAI-compatible tool schema dict."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }

    def __repr__(self) -> str:
        return f"<Tool {self.name!r}>"
