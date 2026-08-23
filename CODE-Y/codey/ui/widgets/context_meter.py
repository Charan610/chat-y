"""Context meter widget — token usage bar with color transitions."""

from textual.app import ComposeResult
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import Static

from codey.ui.theme import ORANGE, ERROR, TEXT_DIM


class ContextMeter(Widget):
    """Displays token usage as a progress bar that color-shifts.

    Colors: gray (<60%) → orange (60-85%) → red (>85%)
    Shows ≈ indicator when using approximate counting.
    """

    DEFAULT_CSS = """
    ContextMeter {
        height: 3;
        width: 100%;
        padding: 0 1;
    }

    ContextMeter .meter-label {
        text-style: bold;
        color: $text;
    }

    ContextMeter .meter-bar {
        height: 1;
        width: 100%;
    }

    ContextMeter .meter-stats {
        color: $text-muted;
    }
    """

    used: reactive[int] = reactive(0)
    total: reactive[int] = reactive(128000)
    percent: reactive[float] = reactive(0.0)
    approximate: reactive[bool] = reactive(True)

    def compose(self) -> ComposeResult:
        yield Static("Context", classes="meter-label")
        yield Static("", classes="meter-bar", id="bar")
        yield Static("", classes="meter-stats", id="stats")

    def watch_percent(self, pct: float) -> None:
        self._update_display()

    def watch_used(self, used: int) -> None:
        self._update_display()

    def update_usage(self, used: int, total: int, percent: float, approximate: bool = True, **_: object) -> None:
        """Called by event bus subscription."""
        self.used = used
        self.total = total
        self.percent = percent
        self.approximate = approximate

    def _update_display(self) -> None:
        bar_width = 20
        filled = int(bar_width * min(self.percent, 100) / 100)
        empty = bar_width - filled

        # Color transitions
        if self.percent >= 85:
            color = ERROR
        elif self.percent >= 60:
            color = ORANGE
        else:
            color = TEXT_DIM

        bar_text = f"[{color}]{'━' * filled}[/][{TEXT_DIM}]{'─' * empty}[/] {self.percent:.0f}%"
        approx = "≈" if self.approximate else ""

        try:
            bar_widget = self.query_one("#bar", Static)
            bar_widget.update(bar_text)

            stats_widget = self.query_one("#stats", Static)
            stats_widget.update(f"{approx}{self.used:,} / {self.total:,} tokens")
        except Exception:
            pass  # Widget not mounted yet
