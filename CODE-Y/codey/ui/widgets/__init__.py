"""Textual widgets for CODE-Y TUI."""

from codey.ui.widgets.context_meter import ContextMeter
from codey.ui.widgets.diff_view import DiffView
from codey.ui.widgets.provider_banner import ProviderBanner
from codey.ui.widgets.slash_command_palette import SlashCommandPalette
from codey.ui.widgets.status_line import StatusLine
from codey.ui.widgets.status_rail import StatusRail
from codey.ui.widgets.thought_stream import ThoughtStream

__all__ = [
    "ContextMeter",
    "DiffView",
    "ProviderBanner",
    "SlashCommandPalette",
    "StatusLine",
    "StatusRail",
    "ThoughtStream",
]
