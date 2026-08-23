"""Filesystem tools: read, write, edit, list, and search files.

These are the agent's primary means of interacting with the user's codebase.
"""

from __future__ import annotations

import fnmatch
import os
import subprocess
from pathlib import Path
from typing import Any

from codey.tools.base import Tool


class ReadFileTool(Tool):
    """Read file contents, optionally within a line range."""

    name = "read_file"
    description = (
        "Read the contents of a file. Returns the file content with line numbers. "
        "Use start_line and end_line to read a specific range."
    )
    parameters = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Path to the file (relative to project root).",
            },
            "start_line": {
                "type": "integer",
                "description": "First line to read (1-indexed, inclusive). Omit to read from the beginning.",
            },
            "end_line": {
                "type": "integer",
                "description": "Last line to read (1-indexed, inclusive). Omit to read to the end.",
            },
        },
        "required": ["path"],
    }
    requires_confirmation = False

    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root

    async def execute(self, **kwargs: Any) -> str:
        path = self._resolve_path(kwargs["path"])
        start_line = kwargs.get("start_line")
        end_line = kwargs.get("end_line")

        if not path.exists():
            return f"Error: File not found: {path}"
        if not path.is_file():
            return f"Error: Not a file: {path}"

        try:
            content = path.read_text(encoding="utf-8", errors="replace")
        except PermissionError:
            return f"Error: Permission denied: {path}"

        lines = content.splitlines()
        total = len(lines)

        # Apply line range
        s = (start_line - 1) if start_line and start_line > 0 else 0
        e = end_line if end_line and end_line <= total else total
        selected = lines[s:e]

        # Format with line numbers
        numbered = []
        for i, line in enumerate(selected, start=s + 1):
            numbered.append(f"{i:>4} │ {line}")

        header = f"── {path.relative_to(self.project_root)} ({s + 1}-{s + len(selected)} of {total} lines) ──"
        return header + "\n" + "\n".join(numbered)

    def _resolve_path(self, raw: str) -> Path:
        p = Path(raw)
        if p.is_absolute():
            return p
        return self.project_root / p


class WriteFileTool(Tool):
    """Write content to a file, creating parent directories as needed."""

    name = "write_file"
    description = (
        "Write content to a file. Creates the file and parent directories if they don't exist. "
        "Overwrites existing content."
    )
    parameters = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Path to the file (relative to project root).",
            },
            "content": {
                "type": "string",
                "description": "The full content to write to the file.",
            },
        },
        "required": ["path", "content"],
    }
    requires_confirmation = True

    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root

    async def execute(self, **kwargs: Any) -> str:
        path = self._resolve_path(kwargs["path"])
        content = kwargs["content"]

        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
            line_count = content.count("\n") + (1 if content and not content.endswith("\n") else 0)
            return f"Successfully wrote {line_count} lines to {path.relative_to(self.project_root)}"
        except PermissionError:
            return f"Error: Permission denied: {path}"
        except Exception as e:
            return f"Error writing file: {e}"

    def _resolve_path(self, raw: str) -> Path:
        p = Path(raw)
        if p.is_absolute():
            return p
        return self.project_root / p


class EditFileTool(Tool):
    """Surgically edit a file by replacing specific content."""

    name = "edit_file"
    description = (
        "Edit a file by replacing a specific block of text with new content. "
        "The old_content must match exactly (including whitespace). "
        "Always read_file first to see the exact content before editing."
    )
    parameters = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Path to the file (relative to project root).",
            },
            "old_content": {
                "type": "string",
                "description": "The exact text to find and replace.",
            },
            "new_content": {
                "type": "string",
                "description": "The replacement text.",
            },
        },
        "required": ["path", "old_content", "new_content"],
    }
    requires_confirmation = True

    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root

    async def execute(self, **kwargs: Any) -> str:
        path = self._resolve_path(kwargs["path"])
        old_content = kwargs["old_content"]
        new_content = kwargs["new_content"]

        if not path.exists():
            return f"Error: File not found: {path}"

        try:
            file_content = path.read_text(encoding="utf-8")
        except PermissionError:
            return f"Error: Permission denied: {path}"

        count = file_content.count(old_content)
        if count == 0:
            return (
                f"Error: Could not find the specified text in {path.relative_to(self.project_root)}. "
                "Make sure old_content matches exactly (including whitespace and indentation). "
                "Use read_file first to see the exact content."
            )
        if count > 1:
            return (
                f"Error: Found {count} occurrences of the specified text. "
                "Please provide a more specific old_content that matches uniquely."
            )

        updated = file_content.replace(old_content, new_content, 1)
        path.write_text(updated, encoding="utf-8")

        # Generate a simple diff summary
        old_lines = old_content.count("\n") + 1
        new_lines = new_content.count("\n") + 1
        return (
            f"Edited {path.relative_to(self.project_root)}: "
            f"replaced {old_lines} lines with {new_lines} lines."
        )

    def _resolve_path(self, raw: str) -> Path:
        p = Path(raw)
        if p.is_absolute():
            return p
        return self.project_root / p


class ListDirectoryTool(Tool):
    """List directory contents in a tree-style format."""

    name = "list_directory"
    description = (
        "List the contents of a directory. Returns files and subdirectories "
        "with their sizes. Use recursive=true for a full tree."
    )
    parameters = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Directory path (relative to project root). Defaults to '.'",
            },
            "recursive": {
                "type": "boolean",
                "description": "If true, list recursively. Default false.",
            },
            "max_depth": {
                "type": "integer",
                "description": "Maximum recursion depth (default 3).",
            },
        },
        "required": [],
    }
    requires_confirmation = False

    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root

    async def execute(self, **kwargs: Any) -> str:
        raw_path = kwargs.get("path", ".")
        recursive = kwargs.get("recursive", False)
        max_depth = kwargs.get("max_depth", 3)

        path = self._resolve_path(raw_path)
        if not path.exists():
            return f"Error: Directory not found: {path}"
        if not path.is_dir():
            return f"Error: Not a directory: {path}"

        lines = [f"── {path.relative_to(self.project_root)}/ ──"]
        self._build_tree(path, lines, prefix="", recursive=recursive, max_depth=max_depth, depth=0)

        # Cap output
        if len(lines) > 200:
            lines = lines[:200]
            lines.append(f"... (truncated, {len(lines)}+ entries)")

        return "\n".join(lines)

    def _build_tree(
        self,
        dir_path: Path,
        lines: list[str],
        prefix: str,
        recursive: bool,
        max_depth: int,
        depth: int,
    ) -> None:
        try:
            entries = sorted(dir_path.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
        except PermissionError:
            lines.append(f"{prefix}[permission denied]")
            return

        # Filter common noise
        skip = {".git", "__pycache__", "node_modules", ".venv", "venv", ".mypy_cache", ".ruff_cache"}
        entries = [e for e in entries if e.name not in skip]

        for i, entry in enumerate(entries):
            is_last = i == len(entries) - 1
            connector = "└── " if is_last else "├── "
            if entry.is_dir():
                lines.append(f"{prefix}{connector}{entry.name}/")
                if recursive and depth < max_depth:
                    extension = "    " if is_last else "│   "
                    self._build_tree(
                        entry, lines, prefix + extension, recursive, max_depth, depth + 1
                    )
            else:
                size = self._human_size(entry.stat().st_size)
                lines.append(f"{prefix}{connector}{entry.name}  ({size})")

    @staticmethod
    def _human_size(size: int) -> str:
        for unit in ("B", "KB", "MB", "GB"):
            if size < 1024:
                return f"{size:.0f}{unit}" if unit == "B" else f"{size:.1f}{unit}"
            size /= 1024
        return f"{size:.1f}TB"

    def _resolve_path(self, raw: str) -> Path:
        p = Path(raw)
        if p.is_absolute():
            return p
        return self.project_root / p


class SearchCodeTool(Tool):
    """Search for patterns in code files using ripgrep or fallback grep."""

    name = "search_code"
    description = (
        "Search for a text pattern across files in the project. "
        "Returns matching lines with file paths and line numbers. "
        "Supports regex patterns."
    )
    parameters = {
        "type": "object",
        "properties": {
            "pattern": {
                "type": "string",
                "description": "The search pattern (regex supported).",
            },
            "path": {
                "type": "string",
                "description": "Directory or file to search in (relative to project root). Defaults to '.'",
            },
            "file_glob": {
                "type": "string",
                "description": "File glob pattern to filter (e.g., '*.py', '*.ts'). Optional.",
            },
        },
        "required": ["pattern"],
    }
    requires_confirmation = False

    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root

    async def execute(self, **kwargs: Any) -> str:
        pattern = kwargs["pattern"]
        raw_path = kwargs.get("path", ".")
        file_glob = kwargs.get("file_glob")

        search_path = self._resolve_path(raw_path)
        if not search_path.exists():
            return f"Error: Path not found: {search_path}"

        # Try ripgrep first, fall back to grep
        try:
            result = self._search_rg(pattern, search_path, file_glob)
        except FileNotFoundError:
            result = self._search_grep(pattern, search_path, file_glob)

        if not result.strip():
            return f"No matches found for pattern: {pattern}"

        lines = result.strip().splitlines()
        if len(lines) > 100:
            lines = lines[:100]
            lines.append(f"... ({len(lines)}+ matches, showing first 100)")

        return "\n".join(lines)

    def _search_rg(self, pattern: str, path: Path, file_glob: str | None) -> str:
        cmd = ["rg", "--no-heading", "--line-number", "--color=never", "-n"]
        if file_glob:
            cmd.extend(["--glob", file_glob])
        cmd.extend([pattern, str(path)])
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return result.stdout

    def _search_grep(self, pattern: str, path: Path, file_glob: str | None) -> str:
        cmd = ["grep", "-rn", "--color=never"]
        if file_glob:
            cmd.extend(["--include", file_glob])
        cmd.extend([pattern, str(path)])
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return result.stdout

    def _resolve_path(self, raw: str) -> Path:
        p = Path(raw)
        if p.is_absolute():
            return p
        return self.project_root / p


def create_fs_tools(project_root: Path) -> list[Tool]:
    """Factory: create all filesystem tools for a project."""
    return [
        ReadFileTool(project_root),
        WriteFileTool(project_root),
        EditFileTool(project_root),
        ListDirectoryTool(project_root),
        SearchCodeTool(project_root),
    ]
