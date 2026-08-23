"""CODE-Y Orange & Black theme for Textual.

Design system:
  - Background: #0A0A0B (near-black)
  - Accent: #FF5F00 (vivid orange) — used ONLY for state changes, active
    tool calls, failover banners, and confirmations. Never as decoration.
  - Text: monochrome grays
"""

from textual.theme import Theme

# ── Color tokens ──
ORANGE = "#FF5F00"
ORANGE_DIM = "#CC4C00"
ORANGE_BRIGHT = "#FF7A1A"
BLACK = "#0A0A0B"
SURFACE = "#111113"
PANEL = "#1A1A1D"
BORDER = "#2A2A2E"
TEXT = "#E0E0E0"
TEXT_DIM = "#777777"
TEXT_MUTED = "#555555"
SUCCESS = "#4ADE80"
ERROR = "#F87171"
WARNING = "#FBBF24"

# ── Textual Theme ──
CODEY_ORANGE_THEME = Theme(
    name="codey_orange",
    primary=ORANGE,
    secondary=ORANGE_DIM,
    accent=ORANGE,
    background=BLACK,
    surface=SURFACE,
    panel=PANEL,
    foreground=TEXT,
    warning=WARNING,
    error=ERROR,
    success=SUCCESS,
    dark=True,
    variables={
        "border": BORDER,
        "text-muted": TEXT_MUTED,
        "text-disabled": TEXT_MUTED,
    },
)
