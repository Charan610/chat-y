"""Quiet, persistent single-line status bar for CODE-Y.

Renders a minimal, non-intrusive status indicator docked above the input bar:
  ⚡ nim/deepseek-v4  ·  ctx 2.4k / 128k (2%)  ·  10 tools  ·  ready
"""

from __future__ import annotations

from textual.app import ComposeResult
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import Static

from codey.ui.theme import ERROR, ORANGE, TEXT_DIM, TEXT_MUTED


class StatusLine(Widget):
    """Minimal, quiet status bar docked near the input bar."""

    DEFAULT_CSS = """
    StatusLine {
        height: 1;
        width: 100%;
        background: #111113;
        color: #777777;
        padding: 0 1;
        border-top: solid #1A1A1D;
    }

    StatusLine Static {
        height: 1;
        width: 100%;
    }
    """

    provider_name: reactive[str] = reactive("NIM")
    model_name: reactive[str] = reactive("deepseek-ai/deepseek-v4")
    used_tokens: reactive[int] = reactive(0)
    total_tokens: reactive[int] = reactive(128_000)
    context_percent: reactive[float] = reactive(0.0)
    approximate: reactive[bool] = reactive(True)
    tool_count: reactive[int] = reactive(10)
    agent_state: reactive[str] = reactive("ready")

    def compose(self) -> ComposeResult:
        yield Static("", id="status-text")

    def on_mount(self) -> None:
        self._update_display()

    def update_provider(self, provider: str, model: str) -> None:
        """Update active provider and model info."""
        self.provider_name = provider
        self.model_name = model
        self._update_display()

    def update_context(
        self,
        used: int,
        total: int,
        percent: float,
        approximate: bool = True,
        **_: object,
    ) -> None:
        """Update token usage metrics."""
        self.used_tokens = used
        self.total_tokens = total
        self.context_percent = percent
        self.approximate = approximate
        self._update_display()

    def update_state(self, state: str) -> None:
        """Update agent execution state."""
        self.agent_state = state
        self._update_display()

    def update_tool_count(self, count: int) -> None:
        """Update total registered tool count."""
        self.tool_count = count
        self._update_display()

    def _update_display(self) -> None:
        try:
            stat_widget = self.query_one("#status-text", Static)

            # Compact model name: e.g. "nim/deepseek-v4"
            clean_model = self.model_name.split("/")[-1] if "/" in self.model_name else self.model_name
            model_badge = f"[{ORANGE}]⚡ {self.provider_name.lower()}/{clean_model}[/]"

            # Context badge with warning colors
            approx = "≈" if self.approximate else ""
            if self.context_percent >= 80:
                ctx_color = ERROR
            elif self.context_percent >= 60:
                ctx_color = ORANGE
            else:
                ctx_color = TEXT_DIM

            ctx_badge = (
                f"[{ctx_color}]ctx {approx}{self.used_tokens:,}/{self.total_tokens:,} "
                f"({self.context_percent:.0f}%)[/]"
            )

            # State formatting
            if self.agent_state == "thinking":
                state_badge = f"[{ORANGE}]thinking...[/]"
            elif self.agent_state == "executing_tool":
                state_badge = f"[{ORANGE}]executing tool...[/]"
            elif self.agent_state == "error":
                state_badge = f"[{ERROR}]error[/]"
            else:
                state_badge = f"[{TEXT_MUTED}]ready[/]"

            tools_badge = f"[{TEXT_DIM}]{self.tool_count} tools[/]"

            stat_widget.update(
                f" {model_badge}  [{TEXT_MUTED}]·[/]  {ctx_badge}  [{TEXT_MUTED}]·[/]  {tools_badge}  [{TEXT_MUTED}]·[/]  {state_badge}"
            )
        except Exception:
            pass
