"""Header row widget for the CODE-Y boxed layout.

Left: ✦ CODE-Y (Phosphor Amber)
Right: ● ONLINE/RETRYING status dot + live 24h clock (HH:MM)
"""

from __future__ import annotations

from datetime import datetime

from textual.app import ComposeResult
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import Static

from codey.ui.theme import ERROR, ORANGE, SUCCESS, TEXT_DIM, TEXT_MUTED


class HeaderBar(Widget):
    """Top header bar inside the box frame."""

    DEFAULT_CSS = """
    HeaderBar {
        height: 1;
        width: 100%;
        background: #0A0A0B;
        padding: 0 1;
    }

    HeaderBar Static {
        height: 1;
    }
    """

    status: reactive[str] = reactive("online")  # "online", "retrying", "offline"
    current_time_str: reactive[str] = reactive("")

    def compose(self) -> ComposeResult:
        yield Static("", id="header-content")

    def on_mount(self) -> None:
        self._update_clock()
        self.set_interval(1.0, self._update_clock)

    def _update_clock(self) -> None:
        self.current_time_str = datetime.now().strftime("%H:%M")
        self._render_header()

    def set_online(self) -> None:
        """Mark provider connection as healthy/online."""
        self.status = "online"
        self._render_header()

    def set_retrying(self) -> None:
        """Mark provider connection as retrying/failover in progress."""
        self.status = "retrying"
        self._render_header()

    def set_offline(self) -> None:
        """Mark provider connection as offline/exhausted."""
        self.status = "offline"
        self._render_header()

    def _render_header(self) -> None:
        try:
            widget = self.query_one("#header-content", Static)

            # Left logo
            left = f"[bold {ORANGE}]✦ CODE-Y[/]"

            # Status dot
            if self.status == "online":
                status_dot = f"[{SUCCESS}]● ONLINE[/]"
            elif self.status == "retrying":
                status_dot = f"[{ORANGE}]● RETRYING[/]"
            else:
                status_dot = f"[{ERROR}]● OFFLINE[/]"

            clock = f"[{TEXT_DIM}]{self.current_time_str}[/]"
            right = f"{status_dot}   {clock}"

            # Compute spacing to push right element to the end
            widget.update(f" {left}{' ' * 400}{right}")
        except Exception:
            pass
