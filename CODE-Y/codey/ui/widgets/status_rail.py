"""Status rail — persistent right-side panel showing model, context, and recent tools."""

from __future__ import annotations

from datetime import datetime, timezone
from collections import deque

from textual.app import ComposeResult
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import Static

from codey.ui.theme import ORANGE, TEXT_DIM, ORANGE_BRIGHT
from codey.ui.widgets.context_meter import ContextMeter


class StatusRail(Widget):
    """Right-side persistent status rail (~24 cols).

    Shows:
      - Active provider/model name
      - Context meter (token usage)
      - Last 3 tool calls with timestamps
    """

    DEFAULT_CSS = """
    StatusRail {
        width: 28;
        height: 100%;
        background: $surface;
        border-left: solid $panel;
        padding: 1;
    }

    StatusRail .rail-header {
        text-style: bold;
        color: $primary;
        margin-bottom: 1;
    }

    StatusRail .rail-section {
        margin-bottom: 1;
    }

    StatusRail .rail-label {
        color: $text-muted;
        text-style: dim;
    }

    StatusRail .rail-value {
        color: $text;
    }

    StatusRail .tool-entry {
        color: $text-muted;
    }
    """

    provider_name: reactive[str] = reactive("—")
    model_name: reactive[str] = reactive("—")

    def __init__(self, **kwargs: object) -> None:
        super().__init__(**kwargs)
        self._recent_tools: deque[tuple[str, str]] = deque(maxlen=3)

    def compose(self) -> ComposeResult:
        yield Static("⚡ CODE-Y", classes="rail-header")
        yield Static("", id="provider-display", classes="rail-section")
        yield ContextMeter()
        yield Static("", id="recent-tools-header", classes="rail-label")
        yield Static("", id="recent-tools", classes="rail-section")

    def on_mount(self) -> None:
        self._update_provider_display()
        self._update_tools_display()

    def update_provider(self, name: str, model: str) -> None:
        self.provider_name = name
        self.model_name = model
        self._update_provider_display()

    def on_tool_call(self, tool_name: str) -> None:
        """Record a tool call for the recent tools display."""
        timestamp = datetime.now(timezone.utc).strftime("%H:%M")
        self._recent_tools.append((tool_name, timestamp))
        self._update_tools_display()

    def on_failover(self, from_provider: str, to_provider: str, **_: object) -> None:
        """Update display on provider failover."""
        # Extract model name from display name (e.g., "NIM (nim_deepseek_v4)" -> parts)
        self.provider_name = to_provider
        self._update_provider_display()

    def _update_provider_display(self) -> None:
        try:
            display = self.query_one("#provider-display", Static)
            display.update(
                f"[{TEXT_DIM}]Provider[/]\n"
                f"[{ORANGE}]{self.provider_name}[/]\n"
                f"[{TEXT_DIM}]{self.model_name}[/]"
            )
        except Exception:
            pass

    def _update_tools_display(self) -> None:
        try:
            header = self.query_one("#recent-tools-header", Static)
            header.update(f"[{TEXT_DIM}]Recent tools[/]")

            tools = self.query_one("#recent-tools", Static)
            if not self._recent_tools:
                tools.update(f"[{TEXT_DIM}](none yet)[/]")
            else:
                lines = []
                for name, ts in self._recent_tools:
                    lines.append(f"[{TEXT_DIM}]• {name}  {ts}[/]")
                tools.update("\n".join(lines))
        except Exception:
            pass
