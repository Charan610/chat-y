"""Diff view — inline diff confirmation widget for file writes."""

from __future__ import annotations

import difflib

from textual.app import ComposeResult
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import Static, RichLog

from codey.ui.theme import ORANGE, SUCCESS, ERROR, TEXT_DIM


class DiffView(Widget):
    """Inline diff confirmation widget.

    Renders unified diff before file writes are committed.
    Accept (y), Reject (n), Edit (e).
    """

    DEFAULT_CSS = """
    DiffView {
        height: auto;
        max-height: 20;
        width: 100%;
        background: $surface;
        border: solid $primary;
        padding: 1;
        display: none;
    }

    DiffView.visible {
        display: block;
    }

    DiffView .diff-header {
        text-style: bold;
        color: $primary;
    }

    DiffView .diff-content {
        height: auto;
        max-height: 14;
    }

    DiffView .diff-prompt {
        text-style: bold;
        color: $primary;
    }
    """

    visible: reactive[bool] = reactive(False)

    def compose(self) -> ComposeResult:
        yield Static("", classes="diff-header", id="diff-header")
        yield RichLog(highlight=False, markup=True, wrap=True, classes="diff-content", id="diff-content")
        yield Static("", classes="diff-prompt", id="diff-prompt")

    def show_diff(self, path: str, old_content: str, new_content: str) -> None:
        """Display a diff for user confirmation."""
        self.add_class("visible")

        header = self.query_one("#diff-header", Static)
        header.update(f"[{ORANGE}]── Changes to {path} ──[/]")

        diff_log = self.query_one("#diff-content", RichLog)
        diff_log.clear()

        # Generate unified diff
        old_lines = old_content.splitlines(keepends=True)
        new_lines = new_content.splitlines(keepends=True)

        diff = difflib.unified_diff(
            old_lines, new_lines,
            fromfile=f"a/{path}",
            tofile=f"b/{path}",
            lineterm="",
        )

        for line in diff:
            if line.startswith("+") and not line.startswith("+++"):
                diff_log.write(f"[{SUCCESS}]{line.rstrip()}[/]")
            elif line.startswith("-") and not line.startswith("---"):
                diff_log.write(f"[{ERROR}]{line.rstrip()}[/]")
            elif line.startswith("@@"):
                diff_log.write(f"[{ORANGE}]{line.rstrip()}[/]")
            else:
                diff_log.write(f"[{TEXT_DIM}]{line.rstrip()}[/]")

        prompt = self.query_one("#diff-prompt", Static)
        prompt.update(f"[{ORANGE}][y]es  [n]o  [e]dit[/]")

    def hide(self) -> None:
        """Hide the diff view."""
        self.remove_class("visible")
