"""Core agent loop: the think → tool_call → execute → feedback state machine.

Every state transition is published to the EventBus so the UI can react
in real time. This is foundational, not an afterthought.
"""

from __future__ import annotations

import asyncio
import enum
import logging
from pathlib import Path
from typing import Any, Callable, Awaitable

from codey.agent.context_manager import ContextManager
from codey.agent.message_types import Message, ToolCall
from codey.agent.system_prompt import build_system_prompt
from codey.providers.base import Provider
from codey.telemetry.event_bus import EventBus, Events
from codey.tools.registry import ToolRegistry
from codey.tools.shell_tool import ShellTool

logger = logging.getLogger(__name__)

MAX_ITERATIONS = 25


class AgentState(enum.Enum):
    """Explicit states for the agent loop state machine."""

    STANDBY = "standby"
    THINKING = "thinking"
    TOOL_CALL_PENDING = "tool_call_pending"
    EXECUTING_TOOL = "executing_tool"
    AWAITING_RESULT = "awaiting_result"
    SYNTHESIZING = "synthesizing"
    ERROR = "error"


class AgentLoop:
    """The core agent loop.

    Manages the conversation lifecycle:
      1. Accept user input
      2. Send to provider (via router in Phase 2, direct provider in Phase 1)
      3. Handle tool calls with confirmation flow
      4. Synthesize final response
      5. Return to standby

    All state transitions emit events for UI transparency.
    """

    def __init__(
        self,
        provider: Provider,
        tool_registry: ToolRegistry,
        event_bus: EventBus,
        context_manager: ContextManager,
        project_root: Path,
        auto_approve_reads: bool = True,
        auto_approve_writes: bool = False,
        auto_approve_shell: bool = False,
        confirmation_callback: Callable[[ToolCall, str], Awaitable[bool]] | None = None,
    ) -> None:
        self.provider = provider
        self.tool_registry = tool_registry
        self.event_bus = event_bus
        self.context_manager = context_manager
        self.project_root = project_root
        self.auto_approve_reads = auto_approve_reads
        self.auto_approve_writes = auto_approve_writes
        self.auto_approve_shell = auto_approve_shell
        self.confirmation_callback = confirmation_callback

        self.state = AgentState.STANDBY
        self.conversation: list[Message] = []
        self._initialized = False

    def _set_state(self, new_state: AgentState) -> None:
        """Transition state and emit event."""
        old_state = self.state
        self.state = new_state
        self.event_bus.emit(Events.STATE_CHANGE, old_state=old_state.value, new_state=new_state.value)
        logger.debug("State: %s → %s", old_state.value, new_state.value)

    def initialize(self) -> None:
        """Set up the system prompt and initialize conversation."""
        if self._initialized:
            return

        system_prompt = build_system_prompt(self.project_root, self.tool_registry)
        self.conversation = [Message(role="system", content=system_prompt)]
        self._initialized = True
        logger.info("Agent initialized with %d tools", self.tool_registry.tool_count())

    async def run(self, user_input: str) -> str:
        """Process a user message through the full agent loop.

        Returns the final assistant text response.
        """
        if not self._initialized:
            self.initialize()

        # Append user message
        self.conversation.append(Message(role="user", content=user_input))

        # Check context compression
        if self.context_manager.needs_compression(self.conversation):
            self.conversation = self.context_manager.compress_history(self.conversation)
            logger.info("Context compressed, now %d messages", len(self.conversation))

        # Update context meter
        self.context_manager.get_usage(self.conversation)

        self._set_state(AgentState.THINKING)

        final_response = ""

        for iteration in range(MAX_ITERATIONS):
            logger.debug("Agent loop iteration %d", iteration + 1)

            try:
                # Get model response
                response = await self.provider.complete(
                    self.conversation,
                    self.tool_registry.get_schemas(),
                )
            except Exception as e:
                self._set_state(AgentState.ERROR)
                error_msg = f"Provider error: {type(e).__name__}: {e}"
                self.event_bus.emit(Events.ERROR, error=error_msg)
                logger.exception("Provider error")
                return error_msg

            self.conversation.append(response)

            # Handle tool calls
            if response.tool_calls:
                all_rejected = True
                for tc in response.tool_calls:
                    self._set_state(AgentState.TOOL_CALL_PENDING)
                    self.event_bus.emit(
                        Events.TOOL_CALL_PENDING,
                        tool_name=tc.name,
                        tool_args=tc.arguments,
                        tool_id=tc.id,
                    )

                    # Confirmation logic
                    if self._requires_confirmation(tc):
                        approved = await self._request_confirmation(tc)
                        if not approved:
                            self.conversation.append(
                                Message(
                                    role="tool",
                                    content="[User rejected this tool call]",
                                    tool_call_id=tc.id,
                                )
                            )
                            continue

                    all_rejected = False
                    self._set_state(AgentState.EXECUTING_TOOL)
                    self.event_bus.emit(Events.TOOL_EXECUTING, tool_name=tc.name)

                    result = await self.tool_registry.execute(tc.name, tc.arguments)

                    self._set_state(AgentState.AWAITING_RESULT)
                    self.event_bus.emit(
                        Events.TOOL_RESULT,
                        tool_name=tc.name,
                        result_preview=result[:200] if result else "(empty)",
                    )

                    self.conversation.append(
                        Message(role="tool", content=result, tool_call_id=tc.id)
                    )

                # Update context meter after tool results
                self.context_manager.get_usage(self.conversation)

                if all_rejected:
                    # All tool calls rejected — let model know and continue
                    self._set_state(AgentState.THINKING)
                    continue

                # Loop back — model will process tool results
                self._set_state(AgentState.THINKING)
                continue

            else:
                # Final text response
                final_response = response.content or ""
                self._set_state(AgentState.SYNTHESIZING)
                self.event_bus.emit(Events.RESPONSE_COMPLETE, content=final_response)
                self._set_state(AgentState.STANDBY)

                # Update context meter
                self.context_manager.get_usage(self.conversation)
                break
        else:
            final_response = "[Max iterations reached. The agent stopped to prevent an infinite loop.]"
            self._set_state(AgentState.STANDBY)

        return final_response

    async def run_streamed(self, user_input: str) -> str:
        """Process user input with streaming output.

        Yields tokens to the event bus as they arrive, then handles
        tool calls in the same loop as run().
        """
        if not self._initialized:
            self.initialize()

        self.conversation.append(Message(role="user", content=user_input))

        if self.context_manager.needs_compression(self.conversation):
            self.conversation = self.context_manager.compress_history(self.conversation)

        self.context_manager.get_usage(self.conversation)
        self._set_state(AgentState.THINKING)

        final_response = ""

        for iteration in range(MAX_ITERATIONS):
            try:
                # Stream response
                full_content = ""
                tool_calls: list[ToolCall] = []

                async for delta in self.provider.stream(
                    self.conversation,
                    self.tool_registry.get_schemas(),
                ):
                    if delta.content:
                        full_content += delta.content
                        self.event_bus.emit(Events.THINKING_TOKEN, token=delta.content)
                    if delta.tool_calls:
                        tool_calls.extend(delta.tool_calls)

                # Build response message
                response = Message(
                    role="assistant",
                    content=full_content if full_content else None,
                    tool_calls=tool_calls if tool_calls else None,
                )
                self.conversation.append(response)

            except Exception as e:
                self._set_state(AgentState.ERROR)
                error_msg = f"Provider error: {type(e).__name__}: {e}"
                self.event_bus.emit(Events.ERROR, error=error_msg)
                return error_msg

            if response.tool_calls:
                for tc in response.tool_calls:
                    self._set_state(AgentState.TOOL_CALL_PENDING)
                    self.event_bus.emit(
                        Events.TOOL_CALL_PENDING,
                        tool_name=tc.name,
                        tool_args=tc.arguments,
                        tool_id=tc.id,
                    )

                    if self._requires_confirmation(tc):
                        approved = await self._request_confirmation(tc)
                        if not approved:
                            self.conversation.append(
                                Message(
                                    role="tool",
                                    content="[User rejected this tool call]",
                                    tool_call_id=tc.id,
                                )
                            )
                            continue

                    self._set_state(AgentState.EXECUTING_TOOL)
                    self.event_bus.emit(Events.TOOL_EXECUTING, tool_name=tc.name)

                    result = await self.tool_registry.execute(tc.name, tc.arguments)

                    self._set_state(AgentState.AWAITING_RESULT)
                    self.event_bus.emit(
                        Events.TOOL_RESULT,
                        tool_name=tc.name,
                        result_preview=result[:200] if result else "(empty)",
                    )
                    self.conversation.append(
                        Message(role="tool", content=result, tool_call_id=tc.id)
                    )

                self.context_manager.get_usage(self.conversation)
                self._set_state(AgentState.THINKING)
                continue
            else:
                final_response = response.content or ""
                self._set_state(AgentState.SYNTHESIZING)
                self.event_bus.emit(Events.RESPONSE_COMPLETE, content=final_response)
                self._set_state(AgentState.STANDBY)
                self.context_manager.get_usage(self.conversation)
                break
        else:
            final_response = "[Max iterations reached.]"
            self._set_state(AgentState.STANDBY)

        return final_response

    def _requires_confirmation(self, tool_call: ToolCall) -> bool:
        """Determine if a tool call needs user confirmation."""
        tool = self.tool_registry.get_tool(tool_call.name)
        if tool is None:
            return True

        # Check special shell tool allowlist logic
        if isinstance(tool, ShellTool):
            return not tool.is_auto_approved(tool_call.arguments.get("command", ""))

        if not tool.requires_confirmation:
            return False

        # Check category-based auto-approve
        if tool.name in ("read_file", "list_directory", "search_code", "git_status", "git_diff", "git_log"):
            return not self.auto_approve_reads

        if tool.name in ("write_file", "edit_file"):
            return not self.auto_approve_writes

        if tool.name == "git_commit":
            return not self.auto_approve_writes

        return True

    async def _request_confirmation(self, tool_call: ToolCall) -> bool:
        """Request user confirmation for a tool call.

        Uses the callback if provided, otherwise defaults to auto-approve
        (for non-interactive mode or testing).
        """
        if self.confirmation_callback:
            description = self._describe_tool_call(tool_call)
            self.event_bus.emit(
                Events.CONFIRMATION_REQUIRED,
                tool_name=tool_call.name,
                tool_args=tool_call.arguments,
                description=description,
            )
            return await self.confirmation_callback(tool_call, description)

        # No callback = auto-approve (non-interactive mode)
        return True

    @staticmethod
    def _describe_tool_call(tc: ToolCall) -> str:
        """Generate a human-readable description of a tool call."""
        if tc.name == "write_file":
            path = tc.arguments.get("path", "?")
            content = tc.arguments.get("content", "")
            lines = content.count("\n") + 1
            return f"Write {lines} lines to {path}"
        elif tc.name == "edit_file":
            path = tc.arguments.get("path", "?")
            return f"Edit {path}"
        elif tc.name == "run_command":
            cmd = tc.arguments.get("command", "?")
            return f"Run: $ {cmd}"
        elif tc.name == "git_commit":
            msg = tc.arguments.get("message", "?")
            return f'Git commit: "{msg}"'
        else:
            return f"Execute {tc.name}({', '.join(f'{k}={v!r}' for k, v in tc.arguments.items())})"
