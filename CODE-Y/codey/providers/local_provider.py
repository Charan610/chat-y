"""Local provider — OpenAI-compatible endpoint for Ollama/LM Studio.

Connects to a local server (default http://localhost:11434/v1).
No API key required — uses a dummy value for the OpenAI client.
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncGenerator

from codey.agent.message_types import Message, StreamDelta, ToolCall, ToolSchema
from codey.config.schema import ProviderConfig
from codey.providers.base import Provider

logger = logging.getLogger(__name__)


class LocalProvider(Provider):
    """Local provider for Ollama, LM Studio, or any OpenAI-compatible local server."""

    def __init__(self, model_alias: str, model_id: str, config: ProviderConfig) -> None:
        # Local servers don't need API keys
        if not config.base_url:
            config = config.model_copy(
                update={"base_url": "http://localhost:11434/v1"}
            )
        super().__init__(
            name="local",
            model_alias=model_alias,
            model_id=model_id,
            config=config,
        )

    def _resolve_api_key(self) -> str | None:
        """Local providers use a dummy API key."""
        return "not-needed"

    async def complete(
        self,
        messages: list[Message],
        tools: list[ToolSchema] | None = None,
    ) -> Message:
        api_messages = self.to_api_messages(messages)
        api_tools = self.to_api_tools(tools)

        kwargs: dict[str, Any] = {
            "model": self.model_id,
            "messages": api_messages,
        }
        if api_tools:
            kwargs["tools"] = api_tools
            kwargs["tool_choice"] = "auto"

        response = await self.client.chat.completions.create(**kwargs)
        choice = response.choices[0]

        tool_calls = None
        if choice.message.tool_calls:
            tool_calls = [
                ToolCall(
                    id=tc.id,
                    name=tc.function.name,
                    arguments=json.loads(tc.function.arguments),
                )
                for tc in choice.message.tool_calls
            ]

        return Message(
            role="assistant",
            content=choice.message.content,
            tool_calls=tool_calls,
        )

    async def stream(
        self,
        messages: list[Message],
        tools: list[ToolSchema] | None = None,
    ) -> AsyncGenerator[StreamDelta, None]:
        api_messages = self.to_api_messages(messages)
        api_tools = self.to_api_tools(tools)

        kwargs: dict[str, Any] = {
            "model": self.model_id,
            "messages": api_messages,
            "stream": True,
        }
        if api_tools:
            kwargs["tools"] = api_tools
            kwargs["tool_choice"] = "auto"

        response = await self.client.chat.completions.create(**kwargs)

        tool_call_accumulators: dict[int, dict[str, Any]] = {}

        async for chunk in response:
            delta = chunk.choices[0].delta if chunk.choices else None
            finish_reason = chunk.choices[0].finish_reason if chunk.choices else None

            if delta is None:
                continue

            content = delta.content if delta.content else None

            if delta.tool_calls:
                for tc_delta in delta.tool_calls:
                    idx = tc_delta.index
                    if idx not in tool_call_accumulators:
                        tool_call_accumulators[idx] = {
                            "id": tc_delta.id or "",
                            "name": "",
                            "arguments": "",
                        }
                    acc = tool_call_accumulators[idx]
                    if tc_delta.id:
                        acc["id"] = tc_delta.id
                    if tc_delta.function:
                        if tc_delta.function.name:
                            acc["name"] += tc_delta.function.name
                        if tc_delta.function.arguments:
                            acc["arguments"] += tc_delta.function.arguments

            if finish_reason == "tool_calls" and tool_call_accumulators:
                completed_calls = []
                for idx in sorted(tool_call_accumulators.keys()):
                    acc = tool_call_accumulators[idx]
                    try:
                        args = json.loads(acc["arguments"]) if acc["arguments"] else {}
                    except json.JSONDecodeError:
                        args = {"raw": acc["arguments"]}
                    completed_calls.append(
                        ToolCall(id=acc["id"], name=acc["name"], arguments=args)
                    )
                yield StreamDelta(tool_calls=completed_calls, finish_reason=finish_reason)
                return

            yield StreamDelta(content=content, finish_reason=finish_reason)
