"""Activity Feed widget for the CODE-Y boxed layout.

Replaces/extends thought stream with the structured glyph vocabulary:
  ◉ (in-progress amber)  ✓ (completed green)  ✗ (failed red)  ◌ (queued dim)

Supported Action Labels:
  Thinking, Search, Read, Write, Edit, Execute, Git, MCP, Failover
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from textual.app import ComposeResult
from textual.binding import Binding
from textual.reactive import reactive
from textual.widget import Widget
from textual.widgets import RichLog

from codey.ui.theme import ERROR, ORANGE, SUCCESS, TEXT, TEXT_DIM, TEXT_MUTED


@dataclass
class ActivityItem:
    """Record of an activity feed item."""

    action: str  # Thinking, Search, Read, Write, Edit, Execute, Git, MCP, Failover
    summary: str
    raw_output: str = ""
    is_error: bool = False
    is_expanded: bool = False


class ActivityFeed(Widget):
    """Activity feed showing structured action rows with live status glyphs."""

    DEFAULT_CSS = """
    ActivityFeed {
        height: 1fr;
        width: 100%;
        background: #0A0A0B;
        padding: 0 1;
    }

    ActivityFeed RichLog {
        height: 100%;
        background: #0A0A0B;
        scrollbar-color: #FF5F00;
        scrollbar-color-hover: #FF7A1A;
        scrollbar-color-active: #FF5F00;
    }
    """

    BINDINGS = [
        Binding("ctrl+o", "toggle_expansion", "Expand/Collapse Output", show=True),
    ]

    verbose: reactive[bool] = reactive(False)

    def __init__(self, **kwargs: object) -> None:
        super().__init__(**kwargs)
        self._items: list[ActivityItem] = []
        self._header_rendered = False

    def compose(self) -> ComposeResult:
        yield RichLog(
            highlight=False,
            markup=True,
            wrap=True,
            id="activity-log",
        )

    @property
    def log_widget(self) -> RichLog:
        return self.query_one("#activity-log", RichLog)

    def on_mount(self) -> None:
        self._ensure_header()

    def _ensure_header(self) -> None:
        if not self._header_rendered:
            self.log_widget.write(f"[{TEXT_MUTED}]─── Activity ──────────────────────────────────────────────────[/]\n")
            self._header_rendered = True

    # ── State / Thinking Tokens ──

    def add_thinking_start(self, initial_summary: str = "Analyzing task and planning next steps...") -> None:
        """Record thinking activity in progress (◉)."""
        self._ensure_header()
        self.log_widget.write(f"  [{ORANGE}]◉ Thinking       [/] [{TEXT_DIM}]{initial_summary}[/]")

    def add_thinking_token(self, token: str) -> None:
        """Stream assistant token incrementally (flicker-free)."""
        self.log_widget.write(token, shrink=False, scroll_end=True)

    # ── Tool Calls (Intent + Result) ──

    def add_tool_pending(self, tool_name: str, tool_args: dict[str, Any], **_: object) -> None:
        """Show pending tool execution with ◉ in-progress glyph."""
        self._ensure_header()
        action_label = self._classify_action(tool_name)
        intent = self._format_intent(tool_name, tool_args)

        item = ActivityItem(action=action_label, summary=intent)
        self._items.append(item)

        self.log_widget.write(f"  [{ORANGE}]◉ {action_label:<14}[/] [{TEXT}]{intent}[/]")

    def add_tool_result(self, tool_name: str, result_preview: str, **_: object) -> None:
        """Record completed tool result with ✓ (or ✗) glyph and collapsed summary."""
        action_label = self._classify_action(tool_name)
        if not self._items:
            item = ActivityItem(action=action_label, summary=tool_name)
            self._items.append(item)
        else:
            item = self._items[-1]

        item.raw_output = result_preview
        is_error = "error" in result_preview.lower()[:30] or "exception" in result_preview.lower()[:30]
        item.is_error = is_error

        # Generate summary
        args = getattr(item, "args", {}) if hasattr(item, "args") else {}
        summary = self._format_result_summary(tool_name, args, result_preview, is_error)
        item.summary = summary

        glyph = f"[{ERROR}]✗[/]" if is_error else f"[{SUCCESS}]✓[/]"
        action_colored = f"[{ERROR}]{action_label:<14}[/]" if is_error else f"[{TEXT_DIM}]{action_label:<14}[/]"

        self.log_widget.write(f"  {glyph} {action_colored} [{TEXT_DIM}]{summary}[/]")

    # ── Failover Row (Special CODE-Y Activity Row) ──

    def add_failover_row(
        self,
        from_provider: str,
        to_provider: str,
        reason: str,
        elapsed: float = 0,
        **_: object,
    ) -> None:
        """Render distinct Failover row matching the activity specification."""
        self._ensure_header()
        elapsed_str = f" ({elapsed:.1f}s)" if elapsed > 0 else ""
        failover_desc = f"{from_provider} {reason}{elapsed_str} → switching to {to_provider}"

        item = ActivityItem(
            action="Failover",
            summary=failover_desc,
            raw_output=failover_desc,
            is_error=True,
        )
        self._items.append(item)

        self.log_widget.write(
            f"  [{ERROR}]✗[/] [{ORANGE}]Failover      [/] [bold #FF7A1A]{failover_desc}[/]"
        )

    # ── Response / Synthesis ──

    def add_response(self, content: str) -> None:
        """Render final response synthesis."""
        if content and not content.startswith("[Max iterations"):
            self.log_widget.write(f"\n{content}\n")

    def add_error(self, error: str, **_: object) -> None:
        """Render error row."""
        self.log_widget.write(f"  [{ERROR}]✗ Error         {error}[/]")

    # ── Interactive Expansion (Ctrl+O) ──

    def action_toggle_expansion(self) -> None:
        """Toggle expanding/collapsing the most recent activity item."""
        if not self._items:
            return

        last = self._items[-1]
        last.is_expanded = not last.is_expanded

        if last.is_expanded:
            preview = last.raw_output
            if len(preview) > 2500:
                preview = preview[:2500] + f"\n... [{len(preview) - 2500} more chars]"
            self.log_widget.write(
                f"\n  [{ORANGE}]─── Expanded: {last.action} ({last.summary}) ───[/]\n"
                f"[{TEXT_DIM}]{preview}[/]\n"
                f"  [{ORANGE}]─── (Ctrl+O to collapse) ───[/]\n"
            )
        else:
            self.log_widget.write(f"  [{TEXT_MUTED}]✓ {last.action} (collapsed)[/]")

    def clear(self) -> None:
        """Clear feed and reset header."""
        self._items.clear()
        self.log_widget.clear()
        self._header_rendered = False
        self._ensure_header()

    # ── Classification & Formatting Helpers ──

    @staticmethod
    def _classify_action(tool_name: str) -> str:
        """Map tool name to standard action label."""
        if tool_name == "search_code":
            return "Search"
        elif tool_name == "read_file":
            return "Read"
        elif tool_name == "write_file":
            return "Write"
        elif tool_name == "edit_file":
            return "Edit"
        elif tool_name == "run_command":
            return "Execute"
        elif tool_name.startswith("git_"):
            return "Git"
        elif tool_name.startswith("mcp_") or "_" in tool_name and "file" not in tool_name:
            return "MCP"
        return "Execute"

    @staticmethod
    def _format_intent(name: str, args: dict[str, Any]) -> str:
        if name == "search_code":
            pattern = args.get("pattern", "?")
            return f"Searching for '{pattern}' across project..."
        elif name == "read_file":
            path = args.get("path", "?")
            return f"Reading {path}..."
        elif name == "write_file":
            path = args.get("path", "?")
            return f"Writing {path}..."
        elif name == "edit_file":
            path = args.get("path", "?")
            return f"Editing {path}..."
        elif name == "run_command":
            cmd = args.get("command", "?")
            return f"Running `{cmd}`..."
        elif name == "list_directory":
            path = args.get("path", ".")
            return f"Listing {path}/ directory..."
        elif name.startswith("git_"):
            return f"Running {name}..."
        else:
            return f"Calling {name}..."

    @staticmethod
    def _format_result_summary(
        name: str,
        args: dict[str, Any],
        raw_result: str,
        is_error: bool,
    ) -> str:
        if is_error:
            err_line = raw_result.strip().splitlines()[0] if raw_result else "Failed"
            return err_line[:65]

        if name == "search_code":
            lines = len([l for l in raw_result.strip().splitlines() if ":" in l])
            if "No matches" in raw_result:
                return "No matches found"
            return f"Found {max(1, lines)} matches"

        elif name == "read_file":
            lines = len(raw_result.splitlines()) - 1
            path = args.get("path", "file")
            return f"Read {path} ({max(1, lines)} lines)"

        elif name == "write_file":
            path = args.get("path", "file")
            return f"Successfully created/updated {path}"

        elif name == "edit_file":
            path = args.get("path", "file")
            return f"Updated {path}"

        elif name == "run_command":
            if "passed" in raw_result:
                m = re.search(r"(\d+ passed[^\n,]*)", raw_result)
                if m:
                    return m.group(1)
            return "Command completed (exit 0)"

        elif name == "list_directory":
            items = len([l for l in raw_result.splitlines() if "──" in l or "├──" in l or "└──" in l])
            return f"Found {items} files and directories"

        elif name == "git_status":
            if "clean" in raw_result.lower():
                return "Working tree clean"
            return "Checked repository status"

        return f"Completed {name}"
