"""Footer keybar widget for the CODE-Y boxed layout.

Renders keybinding hints:
  [Tab] Autocomplete   [/] Commands   [↑↓] History   [Ctrl+O] Expand   [Esc] Cancel
Along with compact live context and provider metrics.
"""

from __future__ import annotations

from textual.app import ComposeResult
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import Static

from codey.ui.theme import ERROR, ORANGE, TEXT_DIM, TEXT_MUTED


class FooterKeybar(Widget):
    """Bottom footer bar showing keybinding hints and compact context stats."""

    DEFAULT_CSS = """
    FooterKeybar {
        height: 1;
        width: 100%;
        background: #0A0A0B;
        padding: 0 1;
    }

    FooterKeybar Static {
        height: 1;
        width: 100%;
    }
    """

    provider_name: reactive[str] = reactive("nim")
    model_name: reactive[str] = reactive("llama-3.3-70b")
    used_tokens: reactive[int] = reactive(0)
    total_tokens: reactive[int] = reactive(128_000)
    context_percent: reactive[float] = reactive(0.0)
    agent_state: reactive[str] = reactive("ready")

    def compose(self) -> ComposeResult:
        yield Static("", id="keybar-content")

    def on_mount(self) -> None:
        self._render_keybar()

    def update_provider(self, provider: str, model: str) -> None:
        self.provider_name = provider.lower()
        self.model_name = model.split("/")[-1] if "/" in model else model
        self._render_keybar()

    def update_context(self, used: int, total: int, percent: float, **_: object) -> None:
        self.used_tokens = used
        self.total_tokens = total
        self.context_percent = percent
        self._render_keybar()

    def update_state(self, state: str) -> None:
        self.agent_state = state
        self._render_keybar()

    def _render_keybar(self) -> None:
        try:
            widget = self.query_one("#keybar-content", Static)

            # Keybindings
            keybar = (
                f"[{ORANGE}][Tab][/] [{TEXT_DIM}]Autocomplete[/]   "
                f"[{ORANGE}][/][/] [{TEXT_DIM}]Commands[/]   "
                f"[{ORANGE}][↑↓][/] [{TEXT_DIM}]History[/]   "
                f"[{ORANGE}][Ctrl+O][/] [{TEXT_DIM}]Expand[/]   "
                f"[{ORANGE}][Esc][/] [{TEXT_DIM}]Cancel[/]"
            )

            # Compact stats
            ctx_color = ERROR if self.context_percent >= 80 else (ORANGE if self.context_percent >= 60 else TEXT_MUTED)
            stats = f"[{TEXT_MUTED}]{self.provider_name}/{self.model_name}[/] [{TEXT_MUTED}]·[/] [{ctx_color}]ctx {self.context_percent:.0f}%[/]"

            widget.update(f" {keybar}{' ' * 200}{stats}")
        except Exception:
            pass
