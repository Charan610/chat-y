"""Greeting and prompt line widget for the CODE-Y boxed layout.

Switches between idle greeting ("Good afternoon, Charan. What would you like me to do?")
and active task banner ("Working on: Build a React dashboard...").
"""

from __future__ import annotations

import getpass
from datetime import datetime

from textual.app import ComposeResult
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import Static

from codey.ui.theme import ORANGE, TEXT, TEXT_DIM, TEXT_MUTED


class GreetingArea(Widget):
    """Greeting area that adapts between idle greeting and active task status."""

    DEFAULT_CSS = """
    GreetingArea {
        height: auto;
        width: 100%;
        background: #0A0A0B;
        padding: 1 1 0 1;
    }

    GreetingArea Static {
        width: 100%;
    }
    """

    user_name: reactive[str] = reactive("")
    active_task: reactive[str] = reactive("")

    def __init__(self, user_name: str | None = None, **kwargs: object) -> None:
        super().__init__(**kwargs)
        if not user_name:
            try:
                user_name = getpass.getuser().capitalize()
            except Exception:
                user_name = "User"
        self.user_name = user_name

    def compose(self) -> ComposeResult:
        yield Static("", id="greeting-text")

    def on_mount(self) -> None:
        self._update_display()

    def set_task(self, task_description: str) -> None:
        """Switch to active task mode."""
        self.active_task = task_description.strip()
        self._update_display()

    def clear_task(self) -> None:
        """Revert back to idle greeting mode."""
        self.active_task = ""
        self._update_display()

    def _get_time_greeting(self) -> str:
        hour = datetime.now().hour
        if 5 <= hour < 12:
            return "Good morning"
        elif 12 <= hour < 17:
            return "Good afternoon"
        elif 17 <= hour < 22:
            return "Good evening"
        else:
            return "Good night"

    def _update_display(self) -> None:
        try:
            widget = self.query_one("#greeting-text", Static)

            if self.active_task:
                # Active mode: show task banner
                display = (
                    f"[{ORANGE}]⚡ Working on:[/] [bold {TEXT}]{self.active_task}[/]\n"
                )
            else:
                # Idle mode: time-aware greeting + prompt
                time_greeting = self._get_time_greeting()
                display = (
                    f"[bold {TEXT}]{time_greeting}, {self.user_name}.[/]\n\n"
                    f"[{TEXT_DIM}]What would you like me to do?[/]\n"
                )

            widget.update(display)
        except Exception:
            pass
