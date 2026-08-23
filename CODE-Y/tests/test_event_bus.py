"""Tests for EventBus pub/sub mechanism."""

import pytest
from codey.telemetry.event_bus import EventBus, Events


def test_sync_event_subscription():
    bus = EventBus()
    received = []

    def handler(token: str, **_):
        received.append(token)

    bus.subscribe(Events.THINKING_TOKEN, handler)
    bus.emit(Events.THINKING_TOKEN, token="abc")
    bus.emit(Events.THINKING_TOKEN, token="def")

    assert received == ["abc", "def"]


@pytest.mark.asyncio
async def test_async_event_subscription():
    bus = EventBus()
    received = []

    async def async_handler(tool_name: str, **_):
        received.append(tool_name)

    bus.subscribe(Events.TOOL_EXECUTING, async_handler)
    await bus.emit_async(Events.TOOL_EXECUTING, tool_name="read_file")

    assert received == ["read_file"]


def test_unsubscribe():
    bus = EventBus()
    received = []

    def handler(error: str, **_):
        received.append(error)

    bus.subscribe(Events.ERROR, handler)
    bus.emit(Events.ERROR, error="err1")
    bus.unsubscribe(Events.ERROR, handler)
    bus.emit(Events.ERROR, error="err2")

    assert received == ["err1"]
