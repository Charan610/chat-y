"""Internal async event bus for agent → UI communication.

Built from Phase 1 so every state transition, tool call, and failover event
is published in real time.  UI widgets subscribe to specific event types and
react accordingly.
"""

from __future__ import annotations

import asyncio
import inspect
import logging
from collections import defaultdict
from typing import Any, Callable, Coroutine

logger = logging.getLogger(__name__)

# Type alias for event handlers (sync or async)
EventHandler = Callable[..., Any]


class EventBus:
    """Lightweight async pub/sub for decoupling agent internals from the UI.

    Usage:
        bus = EventBus()
        bus.subscribe("thinking_token", my_handler)
        bus.emit("thinking_token", token="Hello")

    Handlers can be sync or async.  Async handlers are scheduled as tasks;
    sync handlers are called immediately.  Errors in handlers are logged
    but do not propagate to the emitter.
    """

    def __init__(self) -> None:
        self._subscribers: dict[str, list[EventHandler]] = defaultdict(list)
        self._loop: asyncio.AbstractEventLoop | None = None

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        """Register *handler* to be called whenever *event_type* is emitted."""
        self._subscribers[event_type].append(handler)

    def unsubscribe(self, event_type: str, handler: EventHandler) -> None:
        """Remove a previously registered handler."""
        try:
            self._subscribers[event_type].remove(handler)
        except ValueError:
            pass

    def emit(self, event_type: str, **data: Any) -> None:
        """Publish an event, invoking all registered handlers.

        - Sync handlers are called inline.
        - Async handlers are scheduled on the running event loop.
        - Handler exceptions are logged and swallowed.
        """
        handlers = self._subscribers.get(event_type, [])
        for handler in handlers:
            try:
                if inspect.iscoroutinefunction(handler):
                    loop = self._get_loop()
                    if loop and loop.is_running():
                        loop.create_task(self._run_async_handler(handler, data))
                    else:
                        # Fallback: run synchronously via asyncio.run
                        asyncio.run(handler(**data))
                else:
                    handler(**data)
            except Exception:
                logger.exception(
                    "Error in event handler %s for event '%s'",
                    handler.__name__,
                    event_type,
                )

    async def emit_async(self, event_type: str, **data: Any) -> None:
        """Async version of emit — awaits async handlers directly."""
        handlers = self._subscribers.get(event_type, [])
        for handler in handlers:
            try:
                if inspect.iscoroutinefunction(handler):
                    await handler(**data)
                else:
                    handler(**data)
            except Exception:
                logger.exception(
                    "Error in event handler %s for event '%s'",
                    handler.__name__,
                    event_type,
                )

    def _get_loop(self) -> asyncio.AbstractEventLoop | None:
        """Get the running event loop, caching for performance."""
        try:
            self._loop = asyncio.get_running_loop()
        except RuntimeError:
            self._loop = None
        return self._loop

    @staticmethod
    async def _run_async_handler(
        handler: Callable[..., Coroutine], data: dict[str, Any]
    ) -> None:
        """Wrapper to run async handler with exception logging."""
        try:
            await handler(**data)
        except Exception:
            logger.exception("Error in async event handler %s", handler.__name__)


# Event type constants — single source of truth for event names
class Events:
    """All event types emitted by the CODE-Y agent."""

    STATE_CHANGE = "state_change"
    THINKING_TOKEN = "thinking_token"
    TOOL_CALL_PENDING = "tool_call_pending"
    TOOL_EXECUTING = "tool_executing"
    TOOL_RESULT = "tool_result"
    PROVIDER_FAILOVER = "provider_failover"
    CONTEXT_UPDATE = "context_update"
    RESPONSE_COMPLETE = "response_complete"
    CONFIRMATION_REQUIRED = "confirmation_required"
    CONFIRMATION_RESPONSE = "confirmation_response"
    ERROR = "error"
