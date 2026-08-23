"""Claude Code-style thought stream with collapsible tool call blocks and flicker-free streaming.

Features:
  - Preserves tool call intent BEFORE execution (→ reading auth.py)
  - Results render COLLAPSED by default into a concise one-line summary
  - Interactive expansion: Ctrl+O toggles expanding the most recent / all tool results
  - Smooth append-only streaming (flicker-free)
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
class ToolExecutionRecord:
    """Record of a tool call with its intent, raw result, and collapsed status."""

    name: str
    args: dict[str, Any]
    intent_summary: str
    result_summary: str = ""
    raw_result: str = ""
    is_error: bool = False
    is_expanded: bool = False


class ThoughtStream(Widget):
    """Conversation stream showing reasoning, collapsible tool executions, and responses."""

    DEFAULT_CSS = """
    ThoughtStream {
        height: 100%;
        width: 1fr;
        background: #0A0A0B;
    }

    ThoughtStream RichLog {
        height: 100%;
        background: #0A0A0B;
        scrollbar-color: #FF5F00;
        scrollbar-color-hover: #FF7A1A;
        scrollbar-color-active: #FF5F00;
    }
    """

    BINDINGS = [
        Binding("ctrl+o", "toggle_tool_expansion", "Expand/Collapse Tool", show=True),
    ]

    verbose: reactive[bool] = reactive(False)

    def __init__(self, **kwargs: object) -> None:
        super().__init__(**kwargs)
        self._tool_records: list[ToolExecutionRecord] = []
        self._current_assistant_streaming = False

    def compose(self) -> ComposeResult:
        yield RichLog(
            highlight=False,
            markup=True,
            wrap=True,
            id="stream-log",
        )

    @property
    def log_widget(self) -> RichLog:
        return self.query_one("#stream-log", RichLog)

    # ── User Messages ──

    def add_user_message(self, content: str) -> None:
        """Display a user message."""
        self._current_assistant_streaming = False
        self.log_widget.write(f"\n[bold {ORANGE}]❯[/] [bold {TEXT}]{content}[/]\n")

    # ── Flicker-Free Streaming Tokens ──

    def add_thinking_token(self, token: str) -> None:
        """Append a partial token incrementally without re-rendering."""
        self._current_assistant_streaming = True
        # RichLog.write appends cleanly to the bottom
        self.log_widget.write(token, shrink=False, scroll_end=True)

    # ── Collapsible Tool Calls (Intent + Result Summary) ──

    def add_tool_call_pending(self, tool_name: str, tool_args: dict, **_: object) -> None:
        """Show tool call intent BEFORE execution and register execution record."""
        intent = self._format_tool_intent(tool_name, tool_args)
        record = ToolExecutionRecord(
            name=tool_name,
            args=tool_args,
            intent_summary=intent,
        )
        self._tool_records.append(record)
        self.log_widget.write(f"  [{ORANGE}]⚡ → {intent}[/]")

    def add_tool_executing(self, tool_name: str, **_: object) -> None:
        """Verbose tool execution state update."""
        if self.verbose:
            self.log_widget.write(f"  [{TEXT_MUTED}]  executing {tool_name}...[/]")

    def add_tool_result(self, tool_name: str, result_preview: str, **_: object) -> None:
        """Render completed tool result in collapsed single-line format."""
        if not self._tool_records:
            record = ToolExecutionRecord(name=tool_name, args={}, intent_summary=tool_name)
            self._tool_records.append(record)
        else:
            record = self._tool_records[-1]

        record.raw_result = result_preview
        is_error = "error" in result_preview.lower()[:30] or "exception" in result_preview.lower()[:30]
        record.is_error = is_error

        # Generate smart collapsed summary
        summary = self._generate_collapsed_summary(tool_name, record.args, result_preview, is_error)
        record.result_summary = summary

        status_glyph = f"[{ERROR}]✗[/]" if is_error else f"[{SUCCESS}]✓[/]"
        expand_hint = f"[{TEXT_MUTED}](Ctrl+O to expand)[/]"

        self.log_widget.write(f"  {status_glyph} {summary}  {expand_hint}")

    def action_toggle_tool_expansion(self) -> None:
        """Toggle expanding/collapsing the most recent tool call's output (Ctrl+O)."""
        if not self._tool_records:
            return

        last = self._tool_records[-1]
        last.is_expanded = not last.is_expanded

        if last.is_expanded:
            preview = last.raw_result
            if len(preview) > 2000:
                preview = preview[:2000] + f"\n... [{len(preview) - 2000} more chars]"
            self.log_widget.write(
                f"\n  [{ORANGE}]── Expanded output for {last.intent_summary} ──[/]\n"
                f"[{TEXT_DIM}]{preview}[/]\n"
                f"  [{ORANGE}]── (Ctrl+O to collapse) ──[/]\n"
            )
        else:
            self.log_widget.write(f"  [{TEXT_MUTED}]✓ {last.intent_summary} (collapsed)[/]")

    # ── Final Response & Notifications ──

    def add_response(self, content: str) -> None:
        """Display final synthesized response."""
        self._current_assistant_streaming = False
        if content and not content.startswith("[Max iterations"):
            self.log_widget.write(f"\n{content}\n")

    def add_failover_banner(
        self,
        from_provider: str,
        to_provider: str,
        reason: str,
        elapsed: float = 0,
        **_: object,
    ) -> None:
        """Display provider failover notification."""
        elapsed_str = f" after {elapsed:.1f}s" if elapsed > 0 else ""
        self.log_widget.write(
            f"\n  [bold on #331800] ⚠ {from_provider} {reason}{elapsed_str} "
            f"→ switching to {to_provider} [/]\n"
        )

    def add_error(self, error: str, **_: object) -> None:
        """Display error message."""
        self.log_widget.write(f"\n  [{ERROR}]✗ {error}[/]\n")

    def add_state_change(self, old_state: str, new_state: str, **_: object) -> None:
        """Display state transition (verbose mode only)."""
        if self.verbose:
            self.log_widget.write(f"  [{TEXT_MUTED}]state: {old_state} → {new_state}[/]")

    def clear(self) -> None:
        """Clear conversation stream."""
        self._tool_records.clear()
        self.log_widget.clear()

    # ── Summary Formatting Helpers ──

    @staticmethod
    def _format_tool_intent(name: str, args: dict[str, Any]) -> str:
        """Generate human-readable intent description before execution."""
        if name == "read_file":
            path = args.get("path", "?")
            s = args.get("start_line")
            e = args.get("end_line")
            if s and e:
                return f"reading {path} (lines {s}-{e})"
            return f"reading {path}"
        elif name == "write_file":
            path = args.get("path", "?")
            content = args.get("content", "")
            lines = content.count("\n") + 1 if content else 0
            return f"writing {path} ({lines} lines)"
        elif name == "edit_file":
            path = args.get("path", "?")
            return f"editing {path}"
        elif name == "run_command":
            cmd = args.get("command", "?")
            return f"running {cmd}"
        elif name == "list_directory":
            path = args.get("path", ".")
            return f"listing {path}/"
        elif name == "search_code":
            pattern = args.get("pattern", "?")
            return f"searching for '{pattern}'"
        elif name == "git_status":
            return "checking git status"
        elif name == "git_diff":
            path = args.get("path", "")
            return f"checking git diff {path}".strip()
        elif name == "git_commit":
            msg = args.get("message", "?")
            return f"committing '{msg}'"
        elif name == "git_log":
            return "viewing git log"
        else:
            arg_str = ", ".join(f"{k}={v!r}" for k, v in list(args.items())[:2])
            return f"calling {name}({arg_str})"

    @staticmethod
    def _generate_collapsed_summary(
        name: str,
        args: dict[str, Any],
        raw_result: str,
        is_error: bool,
    ) -> str:
        """Generate a concise Claude Code-style single-line result summary."""
        if is_error:
            err_line = raw_result.strip().splitlines()[0] if raw_result else "Error"
            return f"failed {name}: {err_line[:60]}"

        if name == "read_file":
            path = args.get("path", "file")
            line_count = len(raw_result.splitlines()) - 1  # exclude header
            return f"read {path} ({max(1, line_count)} lines)"

        elif name == "write_file":
            path = args.get("path", "file")
            content = args.get("content", "")
            lines = content.count("\n") + 1 if content else 0
            return f"wrote {path} ({lines} lines)"

        elif name == "edit_file":
            path = args.get("path", "file")
            return f"edited {path}"

        elif name == "run_command":
            cmd = args.get("command", "command")
            clean_cmd = cmd.split()[0] if cmd else "command"
            # Look for test summary patterns (e.g. "12 passed")
            if "passed" in raw_result:
                match = re.search(r"(\d+ passed[^\n,]*)", raw_result)
                if match:
                    return f"ran {clean_cmd} — {match.group(1)}"
            return f"ran {clean_cmd}"

        elif name == "list_directory":
            path = args.get("path", ".")
            items = len([l for l in raw_result.splitlines() if "──" in l or "├──" in l or "└──" in l])
            return f"listed {path}/ ({items} entries)"

        elif name == "search_code":
            pattern = args.get("pattern", "pattern")
            matches = len(raw_result.strip().splitlines()) if raw_result.strip() else 0
            if "No matches" in raw_result:
                return f"searched '{pattern}' — 0 matches"
            return f"searched '{pattern}' — {matches} matches"

        elif name == "git_status":
            if "clean" in raw_result.lower():
                return "git status — working tree clean"
            changed = len(raw_result.strip().splitlines())
            return f"git status — {changed} changed files"

        elif name == "git_diff":
            lines = len(raw_result.strip().splitlines())
            return f"git diff — {lines} lines"

        elif name == "git_commit":
            return "git commit created"

        else:
            return f"completed {name}"
