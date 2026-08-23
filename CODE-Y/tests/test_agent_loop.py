"""Tests for the AgentLoop state machine and tool calling."""

import pytest
from unittest.mock import AsyncMock
from pathlib import Path
from codey.agent.loop import AgentLoop, AgentState
from codey.agent.message_types import Message, ToolCall
from codey.agent.context_manager import ContextManager
from codey.providers.base import Provider
from codey.tools.registry import ToolRegistry
from codey.tools.fs_tools import create_fs_tools
from codey.telemetry.event_bus import EventBus, Events


@pytest.mark.asyncio
async def test_agent_loop_tool_execution(tmp_path: Path):
    event_bus = EventBus()
    state_transitions = []

    def on_state(new_state: str, **_):
        state_transitions.append(new_state)

    event_bus.subscribe(Events.STATE_CHANGE, on_state)

    registry = ToolRegistry()
    registry.register_many(create_fs_tools(tmp_path))

    ctx = ContextManager(event_bus)

    # Mock provider that first requests a write_file tool call, then returns final text
    mock_provider = AsyncMock(spec=Provider)
    mock_provider.name = "mock"
    mock_provider.model_alias = "mock_model"
    mock_provider.model_id = "mock-id"

    tool_call_msg = Message(
        role="assistant",
        tool_calls=[
            ToolCall(id="call_1", name="write_file", arguments={"path": "test.txt", "content": "File created"})
        ],
    )
    final_msg = Message(role="assistant", content="I have created the file.")

    mock_provider.complete.side_effect = [tool_call_msg, final_msg]

    agent = AgentLoop(
        provider=mock_provider,
        tool_registry=registry,
        event_bus=event_bus,
        context_manager=ctx,
        project_root=tmp_path,
        auto_approve_writes=True,
    )

    res = await agent.run("Create test.txt")

    assert res == "I have created the file."
    assert (tmp_path / "test.txt").exists()
    assert (tmp_path / "test.txt").read_text() == "File created"
    assert "thinking" in state_transitions
    assert "tool_call_pending" in state_transitions
    assert "executing_tool" in state_transitions
    assert "synthesizing" in state_transitions
    assert "standby" in state_transitions
