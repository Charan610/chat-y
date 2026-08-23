"""Provider banner — inline failover notification widget."""

from __future__ import annotations

from textual.app import ComposeResult
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import Static

from codey.ui.theme import ORANGE


class ProviderBanner(Widget):
    """Shows failover events inline in the conversation.

    Format: ⚠ NVIDIA NIM (DeepSeek V4) timed out after 12s → switching to Groq (Llama-3.3-70B)
    Auto-dismisses after 5s but remains in scroll history.
    """

    DEFAULT_CSS = """
    ProviderBanner {
        height: auto;
        width: 100%;
        display: none;
    }

    ProviderBanner.visible {
        display: block;
    }

    ProviderBanner .banner-content {
        background: #331800;
        color: $primary;
        padding: 0 2;
        text-style: bold;
    }
    """

    def compose(self) -> ComposeResult:
        yield Static("", classes="banner-content", id="banner-text")

    def show_failover(
        self,
        from_provider: str,
        to_provider: str,
        reason: str,
        elapsed: float = 0,
        **_: object,
    ) -> None:
        """Display a failover notification."""
        self.add_class("visible")

        text = self.query_one("#banner-text", Static)
        elapsed_str = f" after {elapsed:.1f}s" if elapsed > 0 else ""
        text.update(
            f"[{ORANGE}]⚠ {from_provider} {reason}{elapsed_str} "
            f"→ switching to {to_provider}[/]"
        )

        # Auto-dismiss after 5 seconds
        self.set_timer(5.0, self.hide)

    def hide(self) -> None:
        """Hide the banner."""
        self.remove_class("visible")
