"""Claude Code-style slash command and model autocomplete palette for Textual.

Renders a live floating suggestion box above the input bar with fuzzy/prefix
filtering for slash commands AND model selection (`/model <alias>`).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Callable

from textual.app import ComposeResult
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import Static

from codey.agent.slash_commands import SlashCommand, SlashCommandRegistry, create_default_registry
from codey.ui.theme import ERROR, ORANGE, SUCCESS, TEXT_DIM, TEXT_MUTED


@dataclass
class SuggestionItem:
    """A suggestion row in the autocomplete palette."""

    value: str  # Value to insert into input (e.g. "/model nim_llama_3_3")
    display_title: str  # e.g. "nim_llama_3_3"
    display_desc: str  # e.g. "meta/llama-3.3-70b-instruct (NIM)"
    status_badge: str = ""  # e.g. "[✓ Key Set]"
    is_ready: bool = True  # whether key is present


class SlashCommandPalette(Widget):
    """Floating autocomplete popup for slash commands and model selection.

    - When user types '/': suggests available slash commands.
    - When user types '/model ': suggests available models with API key status.
    """

    DEFAULT_CSS = """
    SlashCommandPalette {
        height: auto;
        max-height: 14;
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
        width: 100%;
    }

    SlashCommandPalette .palette-list {
        height: auto;
        width: 100%;
        padding: 0 1;
        color: #E0E0E0;
    }
    """

    visible: reactive[bool] = reactive(False)
    selected_index: reactive[int] = reactive(0)

    def __init__(
        self,
        registry: SlashCommandRegistry | None = None,
        models_provider: Callable[[], list[dict[str, Any]]] | None = None,
        **kwargs: object,
    ) -> None:
        super().__init__(**kwargs)
        self.registry = registry or create_default_registry()
        self.models_provider = models_provider
        self._suggestions: list[SuggestionItem] = []
        self._mode: str = "commands"  # "commands" or "models"

    def compose(self) -> ComposeResult:
        yield Static("  COMMANDS (↑/↓ to navigate, Tab/Enter to select, Esc to close)", classes="palette-header", id="palette-header")
        yield Static("", classes="palette-list", id="palette-list")

    def filter_commands(self, query: str) -> bool:
        """Filter commands or models dynamically based on input query."""
        clean = query.strip()

        # 1. Model Subcommand Mode (e.g. "/model ", "/model groq", "/model nim")
        if query.startswith("/model "):
            return self._filter_models(query[7:].strip().lower())

        # 2. General Slash Command Mode
        if not query.startswith("/"):
            self.hide()
            return False

        # If user typed another complete command with space (e.g. '/verbose '), close palette
        if " " in query:
            self.hide()
            return False

        filtered_cmds = self.registry.filter(query)
        if not filtered_cmds:
            self.hide()
            return False

        self._mode = "commands"
        self._suggestions = [
            SuggestionItem(
                value=f"{cmd.name} " if "<" in cmd.usage else cmd.name,
                display_title=f"{cmd.usage:<18}",
                display_desc=cmd.description,
            )
            for cmd in filtered_cmds
        ]

        if self.selected_index >= len(self._suggestions):
            self.selected_index = 0

        self.show()
        self._render_header("  COMMANDS (↑/↓ to navigate, Tab/Enter to select, Esc to close)")
        self._render_items()
        return True

    def _filter_models(self, subquery: str) -> bool:
        """Suggest models for /model <alias> with live API key status."""
        catalog = self.models_provider() if self.models_provider else self._get_default_model_catalog()

        suggestions: list[SuggestionItem] = []

        for entry in catalog:
            provider_name = entry.get("provider", "").upper()
            has_key = entry.get("has_key", False)
            key_env = entry.get("key_env")

            if key_env:
                badge = f"[{SUCCESS}]✓ Key Set[/]" if has_key else f"[{ERROR}]✗ No Key ({key_env})[/]"
            else:
                badge = f"[{SUCCESS}]✓ Local[/]"

            for m in entry.get("models", []):
                alias = m.get("alias", "")
                model_id = m.get("model_id", "")

                # Filter by user subquery
                if subquery and (subquery not in alias.lower() and subquery not in model_id.lower() and subquery not in provider_name.lower()):
                    continue

                active_flag = " [ACTIVE]" if m.get("is_active") else ""
                desc = f"{model_id} ({provider_name}){active_flag}"

                suggestions.append(
                    SuggestionItem(
                        value=f"/model {alias}",
                        display_title=f"{alias:<20}",
                        display_desc=desc,
                        status_badge=badge,
                        is_ready=has_key,
                    )
                )

        all_aliases = [m.get("alias", "").lower() for entry in catalog for m in entry.get("models", [])]
        if subquery and subquery in all_aliases:
            # Exact model alias already typed/completed -> close palette
            self.hide()
            return False

        if not suggestions:
            self.hide()
            return False

        # Prioritize ready models with active keys at the top
        suggestions.sort(key=lambda s: (not s.is_ready, s.display_title))

        self._mode = "models"
        self._suggestions = suggestions

        if self.selected_index >= len(self._suggestions):
            self.selected_index = 0

        self.show()
        self._render_header("  SELECT MODEL (↑/↓ to navigate, Tab/Enter to switch active model)")
        self._render_items()
        return True

    def _get_default_model_catalog(self) -> list[dict[str, Any]]:
        """Fallback catalog if router not injected."""
        return [
            {
                "provider": "nim",
                "key_env": "NVIDIA_API_KEY",
                "has_key": bool(os.getenv("NVIDIA_API_KEY")),
                "models": [
                    {"alias": "nim_llama_3_3", "model_id": "meta/llama-3.3-70b-instruct"},
                    {"alias": "nim_deepseek_r1", "model_id": "deepseek-ai/deepseek-r1"},
                ],
            },
            {
                "provider": "groq",
                "key_env": "GROQ_API_KEY",
                "has_key": bool(os.getenv("GROQ_API_KEY")),
                "models": [
                    {"alias": "groq_llama_3_3_70b", "model_id": "llama-3.3-70b-versatile"},
                ],
            },
            {
                "provider": "gemini",
                "key_env": "GEMINI_API_KEY",
                "has_key": bool(os.getenv("GEMINI_API_KEY")),
                "models": [
                    {"alias": "gemini_2_5_pro", "model_id": "gemini-2.5-pro"},
                ],
            },
            {
                "provider": "local",
                "key_env": None,
                "has_key": True,
                "models": [
                    {"alias": "local_ollama", "model_id": "llama3.3"},
                ],
            },
        ]

    def show(self) -> None:
        self.visible = True
        self.add_class("visible")

    def hide(self) -> None:
        self.visible = False
        self.remove_class("visible")
        self.selected_index = 0

    @property
    def is_open(self) -> bool:
        return self.visible and bool(self._suggestions)

    def move_up(self) -> None:
        if not self._suggestions:
            return
        if self.selected_index > 0:
            self.selected_index -= 1
        else:
            self.selected_index = len(self._suggestions) - 1
        self._render_items()

    def move_down(self) -> None:
        if not self._suggestions:
            return
        if self.selected_index < len(self._suggestions) - 1:
            self.selected_index += 1
        else:
            self.selected_index = 0
        self._render_items()

    def get_selected(self) -> SuggestionItem | None:
        if not self._suggestions:
            return None
        if 0 <= self.selected_index < len(self._suggestions):
            return self._suggestions[self.selected_index]
        return None

    def _render_header(self, title: str) -> None:
        try:
            self.query_one("#palette-header", Static).update(title)
        except Exception:
            pass

    def _render_items(self) -> None:
        try:
            list_widget = self.query_one("#palette-list", Static)
            lines = []

            for i, item in enumerate(self._suggestions):
                is_selected = i == self.selected_index
                badge_str = f" {item.status_badge}" if item.status_badge else ""

                if is_selected:
                    lines.append(f"[bold on #FF5F00 black]▶ {item.display_title} {item.display_desc}{badge_str} [/]")
                else:
                    lines.append(f"  [{ORANGE}]{item.display_title}[/] [{TEXT_DIM}]{item.display_desc}[/]{badge_str}")

            list_widget.update("\n".join(lines))
        except Exception:
            pass
