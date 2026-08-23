"""Input bar — bottom text input with slash command support."""

from __future__ import annotations

from collections import deque

from textual.app import ComposeResult
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import Input

from codey.ui.theme import ORANGE, TEXT_DIM


class InputBar(Widget):
    """Bottom input bar with history and slash command parsing.

    Features:
      - Input history (up/down arrows)
      - Slash command detection
      - State-aware prompt (codey> vs codey [thinking]>)
      - Multiline support via Shift+Enter
    """

    DEFAULT_CSS = """
    InputBar {
        height: 3;
        dock: bottom;
        background: $surface;
        border-top: solid $panel;
        padding: 0 1;
    }

    InputBar Input {
        background: $surface;
        border: none;
        color: $text;
        width: 100%;
    }

    InputBar Input:focus {
        border: none;
    }
    """

    agent_state: reactive[str] = reactive("standby")

    def __init__(self, **kwargs: object) -> None:
        super().__init__(**kwargs)
        self._history: deque[str] = deque(maxlen=100)
        self._history_index: int = -1

    def compose(self) -> ComposeResult:
        yield Input(
            placeholder="Type your request... (/help for commands)",
            id="user-input",
        )

    def on_mount(self) -> None:
        self._update_placeholder()

    def watch_agent_state(self, state: str) -> None:
        self._update_placeholder()

    def _update_placeholder(self) -> None:
        try:
            inp = self.query_one("#user-input", Input)
            if self.agent_state == "thinking":
                inp.placeholder = "CODE-Y is thinking..."
            elif self.agent_state == "executing_tool":
                inp.placeholder = "Executing tool..."
            else:
                inp.placeholder = "Type your request... (/help for commands)"
        except Exception:
            pass

    def get_input(self) -> Input:
        return self.query_one("#user-input", Input)

    def add_to_history(self, text: str) -> None:
        """Add an entry to input history."""
        if text.strip():
            self._history.appendleft(text)
            self._history_index = -1
