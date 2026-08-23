"""Abstract base class for all LLM providers.

Every provider (NIM, Groq, Gemini, Local) implements this interface.
The router interacts only through this contract, enabling transparent failover.
"""

from __future__ import annotations

import os
from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator

from openai import AsyncOpenAI

from codey.agent.message_types import Message, StreamDelta, ToolSchema
from codey.config.schema import ProviderConfig


class Provider(ABC):
    """Base class for LLM provider adapters.

    Each provider wraps an OpenAI-compatible endpoint and translates
    between CODE-Y's normalized message format and the provider's API.
    """

    name: str
    model_id: str
    model_alias: str
    config: ProviderConfig
    client: AsyncOpenAI

    def __init__(self, name: str, model_alias: str, model_id: str, config: ProviderConfig) -> None:
        self.name = name
        self.model_alias = model_alias
        self.model_id = model_id
        self.config = config

        # Resolve API key from environment
        api_key = self._resolve_api_key()
        base_url = config.base_url

        self.client = AsyncOpenAI(
            api_key=api_key or "not-needed",
            base_url=base_url,
        )

    def _resolve_api_key(self) -> str | None:
        """Resolve the API key from the environment variable in config."""
        if self.config.api_key_env:
            return os.environ.get(self.config.api_key_env)
        return None

    @abstractmethod
    async def complete(
        self,
        messages: list[Message],
        tools: list[ToolSchema] | None = None,
    ) -> Message:
        """Send messages and return a complete response.

        Args:
            messages: Normalized conversation history.
            tools: Available tool schemas (OpenAI function-calling format).

        Returns:
            A normalized Message with the model's response.
        """
        ...

    @abstractmethod
    async def stream(
        self,
        messages: list[Message],
        tools: list[ToolSchema] | None = None,
    ) -> AsyncGenerator[StreamDelta, None]:
        """Stream a response, yielding deltas as they arrive.

        Used by the thought_stream widget for live token display.
        """
        ...

    def to_api_messages(self, messages: list[Message]) -> list[dict[str, Any]]:
        """Convert normalized messages to OpenAI API format."""
        api_msgs = []
        for msg in messages:
            m: dict[str, Any] = {"role": msg.role}
            if msg.content is not None:
                m["content"] = msg.content
            if msg.tool_calls:
                m["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": self._serialize_arguments(tc.arguments),
                        },
                    }
                    for tc in msg.tool_calls
                ]
                # OpenAI requires content to be present (can be null)
                if "content" not in m:
                    m["content"] = None
            if msg.tool_call_id:
                m["tool_call_id"] = msg.tool_call_id
            api_msgs.append(m)
        return api_msgs

    def to_api_tools(self, tools: list[ToolSchema] | None) -> list[dict[str, Any]] | None:
        """Convert normalized tool schemas to OpenAI API format."""
        if not tools:
            return None
        return [
            {
                "type": "function",
                "function": {
                    "name": tool.function.name,
                    "description": tool.function.description,
                    "parameters": tool.function.parameters,
                },
            }
            for tool in tools
        ]

    @staticmethod
    def _serialize_arguments(arguments: dict[str, Any]) -> str:
        """Serialize tool call arguments to JSON string."""
        import json

        return json.dumps(arguments)

    def display_name(self) -> str:
        """Human-readable name for UI display."""
        return f"{self.name.upper()} ({self.model_alias})"

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} name={self.name!r} model={self.model_id!r}>"
