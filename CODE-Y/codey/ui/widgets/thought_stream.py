"""Thought stream — live streaming of reasoning + tool call intents."""

from __future__ import annotations

from textual.app import ComposeResult
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import Static, RichLog

from codey.ui.theme import ORANGE, TEXT_DIM, ORANGE_BRIGHT, SUCCESS, ERROR


class ThoughtStream(Widget):
    """Live streaming widget showing reasoning, tool calls, and responses.

    Shows:
      - Streamed reasoning tokens as they arrive
      - Tool call intents BEFORE execution (→ reading auth.py)
      - Tool results (abbreviated)
      - Final responses
      - Failover banners
    """

    DEFAULT_CSS = """
    ThoughtStream {
        height: 100%;
        width: 1fr;
        background: $background;
    }

    ThoughtStream RichLog {
        height: 100%;
        background: $background;
        scrollbar-color: $primary;
        scrollbar-color-hover: $primary;
        scrollbar-color-active: $primary;
    }
    """

    verbose: reactive[bool] = reactive(False)

    def compose(self) -> ComposeResult:
        yield RichLog(
            highlight=True,
            markup=True,
            wrap=True,
            id="stream-log",
        )

    @property
    def log_widget(self) -> RichLog:
        return self.query_one("#stream-log", RichLog)

    def add_user_message(self, content: str) -> None:
        """Display a user message."""
        self.log_widget.write(f"\n[bold]{content}[/bold]\n")

    def add_thinking_token(self, token: str) -> None:
        """Append a streamed thinking token."""
        # RichLog.write appends; for streaming we accumulate
        self.log_widget.write(token, shrink=False, scroll_end=True)

    def add_tool_call_pending(self, tool_name: str, tool_args: dict, **_: object) -> None:
        """Show a tool call intent BEFORE execution."""
        args_preview = ", ".join(f"{k}={repr(v)[:40]}" for k, v in tool_args.items())
        self.log_widget.write(
            f"\n  [{ORANGE}]→ {tool_name}[/]({args_preview})"
        )

    def add_tool_result(self, tool_name: str, result_preview: str, **_: object) -> None:
        """Show abbreviated tool result."""
        preview = result_preview[:150].replace("\n", " ")
        self.log_widget.write(f"  [{TEXT_DIM}]← {tool_name}: {preview}[/]")

    def add_tool_executing(self, tool_name: str, **_: object) -> None:
        """Show tool execution indicator."""
        self.log_widget.write(f"  [{ORANGE}]⚡ executing {tool_name}...[/]")

    def add_response(self, content: str) -> None:
        """Display the final assistant response."""
        self.log_widget.write(f"\n{content}\n")

    def add_failover_banner(
        self,
        from_provider: str,
        to_provider: str,
        reason: str,
        elapsed: float = 0,
        **_: object,
    ) -> None:
        """Show provider failover notification."""
        self.log_widget.write(
            f"\n  [bold on #331800]⚠ {from_provider} {reason} "
            f"→ switching to {to_provider}[/]\n"
        )

    def add_error(self, error: str, **_: object) -> None:
        """Show error message."""
        self.log_widget.write(f"\n  [{ERROR}]✗ {error}[/]")

    def add_state_change(self, old_state: str, new_state: str, **_: object) -> None:
        """Show state transition (verbose mode only)."""
        if self.verbose:
            self.log_widget.write(f"  [{TEXT_DIM}]{old_state} → {new_state}[/]")

    def clear(self) -> None:
        """Clear the stream."""
        self.log_widget.clear()
