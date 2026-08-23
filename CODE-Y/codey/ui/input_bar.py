"""Input bar widget with integrated slash-command autocomplete popup.

Handles live reactive filtering as user types '/', keyboard navigation
(Up/Down/Tab/Enter/Escape), history cycling, and state-aware placeholder.
"""

from __future__ import annotations

from collections import deque

from textual.app import ComposeResult
from textual.containers import Vertical
from textual.events import Key
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import Input

from codey.agent.slash_commands import SlashCommandRegistry
from codey.ui.widgets.slash_command_palette import SlashCommandPalette


class InputBar(Widget):
    """Bottom input bar with integrated slash-command autocomplete palette."""

    DEFAULT_CSS = """
    InputBar {
        height: auto;
        dock: bottom;
        background: #0A0A0B;
        padding: 0;
    }

    InputBar Vertical {
        height: auto;
        width: 100%;
    }

    InputBar Input {
        background: #111113;
        border: solid #2A2A2E;
        color: #E0E0E0;
        width: 100%;
        height: 3;
        padding: 0 1;
    }

    InputBar Input:focus {
        border: solid #FF5F00;
    }
    """

    agent_state: reactive[str] = reactive("standby")

    def __init__(
        self,
        slash_registry: SlashCommandRegistry | None = None,
        **kwargs: object,
    ) -> None:
        super().__init__(**kwargs)
        self.slash_registry = slash_registry
        self._history: deque[str] = deque(maxlen=100)
        self._history_index: int = -1

    def compose(self) -> ComposeResult:
        with Vertical():
            yield SlashCommandPalette(registry=self.slash_registry, id="slash-palette")
            yield Input(
                placeholder="Type your request... (/ for commands)",
                id="user-input",
            )

    @property
    def palette(self) -> SlashCommandPalette:
        return self.query_one("#slash-palette", SlashCommandPalette)

    @property
    def input_widget(self) -> Input:
        return self.query_one("#user-input", Input)

    def on_mount(self) -> None:
        self._update_placeholder()

    def watch_agent_state(self, state: str) -> None:
        self._update_placeholder()

    def _update_placeholder(self) -> None:
        try:
            inp = self.input_widget
            if self.agent_state == "thinking":
                inp.placeholder = "CODE-Y is thinking..."
            elif self.agent_state == "executing_tool":
                inp.placeholder = "Executing tool..."
            else:
                inp.placeholder = "Type your request... (/ for commands)"
        except Exception:
            pass

    def on_input_changed(self, event: Input.Changed) -> None:
        """Filter slash command suggestions live as user types."""
        val = event.value
        if val.startswith("/"):
            self.palette.filter_commands(val)
        else:
            self.palette.hide()

    def on_key(self, event: Key) -> None:
        """Handle keyboard navigation for autocomplete and history."""
        # 1. If slash command palette is open, handle navigation
        if self.palette.is_open:
            if event.key == "up":
                event.prevent_default()
                event.stop()
                self.palette.move_up()
                return
            elif event.key == "down":
                event.prevent_default()
                event.stop()
                self.palette.move_down()
                return
            elif event.key == "tab":
                event.prevent_default()
                event.stop()
                self._accept_suggestion()
                return
            elif event.key == "escape":
                event.prevent_default()
                event.stop()
                self.palette.hide()
                return
            elif event.key == "enter":
                # If command is incomplete, complete it first
                sel = self.palette.get_selected()
                current = self.input_widget.value.strip()
                if sel and current != sel.name and not current.startswith(f"{sel.name} "):
                    event.prevent_default()
                    event.stop()
                    self._accept_suggestion()
                    return

        # 2. Input history navigation when palette is closed
        if not self.palette.is_open:
            if event.key == "up" and self._history:
                if self._history_index < len(self._history) - 1:
                    self._history_index += 1
                    self.input_widget.value = self._history[self._history_index]
                    self.input_widget.cursor_position = len(self.input_widget.value)
                event.prevent_default()
            elif event.key == "down":
                if self._history_index > 0:
                    self._history_index -= 1
                    self.input_widget.value = self._history[self._history_index]
                    self.input_widget.cursor_position = len(self.input_widget.value)
                elif self._history_index == 0:
                    self._history_index = -1
                    self.input_widget.value = ""
                event.prevent_default()

    def _accept_suggestion(self) -> None:
        """Accept the currently highlighted suggestion."""
        sel = self.palette.get_selected()
        if not sel:
            return

        # Insert command name with trailing space if parameters needed
        if "<" in sel.usage:
            new_val = f"{sel.name} "
        else:
            new_val = sel.name

        self.input_widget.value = new_val
        self.input_widget.cursor_position = len(new_val)
        self.palette.hide()

    def add_to_history(self, text: str) -> None:
        """Record input in history."""
        if text.strip():
            self._history.appendleft(text)
            self._history_index = -1
            self.palette.hide()
