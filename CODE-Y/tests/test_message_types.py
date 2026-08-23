"""Tests for CODE-Y message types."""

from codey.agent.message_types import Message, ToolCall, StreamDelta, ToolSchema, ToolFunctionSchema


def test_tool_call_creation():
    tc = ToolCall(name="read_file", arguments={"path": "main.py"})
    assert tc.name == "read_file"
    assert tc.arguments == {"path": "main.py"}
    assert tc.id.startswith("call_")


def test_message_creation():
    msg = Message(role="user", content="Hello")
    assert msg.role == "user"
    assert msg.content == "Hello"
    assert msg.token_estimate() > 0


def test_message_with_tool_calls():
    tc = ToolCall(name="write_file", arguments={"path": "test.txt", "content": "hello"})
    msg = Message(role="assistant", tool_calls=[tc])
    assert msg.role == "assistant"
    assert len(msg.tool_calls) == 1
    assert msg.token_estimate() > 0


def test_tool_schema_generation():
    schema = ToolSchema(
        function=ToolFunctionSchema(
            name="test_tool",
            description="A test tool",
            parameters={"type": "object", "properties": {}},
        )
    )
    dumped = schema.model_dump()
    assert dumped["type"] == "function"
    assert dumped["function"]["name"] == "test_tool"
