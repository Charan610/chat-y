"""Claude Code-style slash command autocomplete palette for Textual.

Renders a live floating suggestion box above the input bar with fuzzy/prefix
filtering, keyboard navigation (Up/Down/Tab/Enter/Escape), and Phosphor Amber styling.
"""

from __future__ import annotations

from textual.app import ComposeResult
from textual.containers import Vertical
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import Static

from codey.agent.slash_commands import SlashCommand, SlashCommandRegistry, create_default_registry
from codey.ui.theme import ORANGE, ORANGE_DIM, PANEL, SURFACE, TEXT, TEXT_DIM, TEXT_MUTED


class SlashCommandPalette(Widget):
    """Floating autocomplete popup for slash commands.

    Displays matching commands as the user types '/' into the input bar.
    """

    DEFAULT_CSS = """
    SlashCommandPalette {
        height: auto;
        max-height: 12;
        width: 100%;
        background: #111113;
        border: solid #2A2A2E;
        padding: 0 1;
        display: none;
        margin-bottom: 0;
    }

    SlashCommandPalette.visible {
        display: block;
    }

    SlashCommandPalette .palette-header {
        color: #777777;
        padding: 0 1;
        text-style: bold dim;
        border-bottom: solid #1A1A1D;
        height: 1;
    }

    SlashCommandPalette .palette-row {
        height: 1;
        padding: 0 1;
        color: #E0E0E0;
    }

    SlashCommandPalette .palette-row.selected {
        background: #FF5F00;
        color: #0A0A0B;
        text-style: bold;
    }
    """

    visible: reactive[bool] = reactive(False)
    selected_index: reactive[int] = reactive(0)

    def __init__(
        self,
        registry: SlashCommandRegistry | None = None,
        **kwargs: object,
    ) -> None:
        super().__init__(**kwargs)
        self.registry = registry or create_default_registry()
        self._filtered_commands: list[SlashCommand] = []

    def compose(self) -> ComposeResult:
        yield Static("  COMMANDS (↑/↓ to navigate, Tab/Enter to select, Esc to close)", classes="palette-header", id="palette-header")
        yield Vertical(id="palette-items")

    def filter_commands(self, query: str) -> bool:
        """Filter commands by query string.

        Returns True if palette should be visible (matches found), False otherwise.
        """
        # If user typed full command + space (e.g. '/model '), close palette
        if " " in query.strip():
            self.hide()
            return False

        if not query.startswith("/"):
            self.hide()
            return False

        self._filtered_commands = self.registry.filter(query)

        if not self._filtered_commands:
            self.hide()
            return False

        # Reset or clamp selected index
        if self.selected_index >= len(self._filtered_commands):
            self.selected_index = 0

        self.show()
        self._render_items()
        return True

    def show(self) -> None:
        """Show the palette."""
        self.visible = True
        self.add_class("visible")

    def hide(self) -> None:
        """Hide the palette."""
        self.visible = False
        self.remove_class("visible")
        self.selected_index = 0

    @property
    def is_open(self) -> bool:
        """Check if palette is currently visible."""
        return self.visible and bool(self._filtered_commands)

    def move_up(self) -> None:
        """Move selection up."""
        if not self._filtered_commands:
            return
        if self.selected_index > 0:
            self.selected_index -= 1
        else:
            self.selected_index = len(self._filtered_commands) - 1
        self._render_items()

    def move_down(self) -> None:
        """Move selection down."""
        if not self._filtered_commands:
            return
        if self.selected_index < len(self._filtered_commands) - 1:
            self.selected_index += 1
        else:
            self.selected_index = 0
        self._render_items()

    def get_selected(self) -> SlashCommand | None:
        """Get the currently highlighted command."""
        if not self._filtered_commands:
            return None
        if 0 <= self.selected_index < len(self._filtered_commands):
            return self._filtered_commands[self.selected_index]
        return None

    def _render_items(self) -> None:
        """Render filtered suggestion rows with selection highlight."""
        try:
            container = self.query_one("#palette-items", Vertical)
            container.remove_children()

            for i, cmd in enumerate(self._filtered_commands):
                is_selected = i == self.selected_index
                row_class = "palette-row selected" if is_selected else "palette-row"

                usage_pad = f"{cmd.usage:<18}"
                if is_selected:
                    row_text = f"▶ {usage_pad} {cmd.description}"
                else:
                    row_text = f"  [{ORANGE}]{usage_pad}[/] [{TEXT_DIM}]{cmd.description}[/]"

                container.mount(Static(row_text, classes=row_class))
        except Exception:
            pass  # Not mounted yet
