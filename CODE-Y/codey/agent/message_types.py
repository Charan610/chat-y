"""Provider-agnostic message types for the CODE-Y agent loop.

All conversation history is stored in this normalized format.  Provider
adapters translate to/from these types at the edges.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


class ToolCall(BaseModel):
    """A tool invocation requested by the model."""

    id: str = Field(default_factory=lambda: f"call_{uuid.uuid4().hex[:12]}")
    name: str
    arguments: dict[str, Any]


class StreamDelta(BaseModel):
    """A single chunk of a streaming response."""

    content: str | None = None
    tool_calls: list[ToolCall] | None = None
    finish_reason: str | None = None


class Message(BaseModel):
    """Normalized message in the conversation history.

    Roles:
      - system:    system prompt or injected context
      - user:      human input
      - assistant: model response (may include tool_calls)
      - tool:      result of a tool execution
    """

    role: Literal["system", "user", "assistant", "tool"]
    content: str | None = None
    tool_calls: list[ToolCall] | None = None
    tool_call_id: str | None = None  # set when role == "tool"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def token_estimate(self) -> int:
        """Rough token estimate for context tracking (≈4 chars/token)."""
        char_count = 0
        if self.content:
            char_count += len(self.content)
        if self.tool_calls:
            for tc in self.tool_calls:
                char_count += len(tc.name) + len(str(tc.arguments))
        return max(1, char_count // 4)


class ToolSchema(BaseModel):
    """OpenAI-compatible tool definition schema."""

    type: str = "function"
    function: ToolFunctionSchema


class ToolFunctionSchema(BaseModel):
    """The function definition within a tool schema."""

    name: str
    description: str
    parameters: dict[str, Any]  # JSON Schema object


# Re-export for convenience
ToolSchema.model_rebuild()
