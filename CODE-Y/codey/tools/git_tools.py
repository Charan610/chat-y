"""Git tools: status, diff, commit, and log.

Wrappers around git CLI commands for agent-driven version control.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

from codey.tools.base import Tool


async def _run_git(args: list[str], cwd: Path, timeout: int = 30) -> tuple[int, str, str]:
    """Run a git command and return (exit_code, stdout, stderr)."""
    proc = await asyncio.create_subprocess_exec(
        "git",
        *args,
        cwd=str(cwd),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return -1, "", "Git command timed out"

    return (
        proc.returncode or 0,
        stdout.decode("utf-8", errors="replace"),
        stderr.decode("utf-8", errors="replace"),
    )


class GitStatusTool(Tool):
    """Show git working tree status."""

    name = "git_status"
    description = "Show the current git status (staged, modified, untracked files)."
    parameters = {"type": "object", "properties": {}, "required": []}
    requires_confirmation = False

    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root

    async def execute(self, **kwargs: Any) -> str:
        code, stdout, stderr = await _run_git(
            ["status", "--short", "--branch"], self.project_root
        )
        if code != 0:
            return f"Error: {stderr.strip()}"
        return stdout.strip() if stdout.strip() else "Working tree clean."


class GitDiffTool(Tool):
    """Show git diff for working tree or a specific file."""

    name = "git_diff"
    description = (
        "Show git diff of uncommitted changes. "
        "Optionally specify a file path to diff a single file."
    )
    parameters = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Optional file path to diff (relative to project root).",
            },
            "staged": {
                "type": "boolean",
                "description": "If true, show staged (cached) changes. Default false.",
            },
        },
        "required": [],
    }
    requires_confirmation = False

    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root

    async def execute(self, **kwargs: Any) -> str:
        args = ["diff"]
        if kwargs.get("staged"):
            args.append("--cached")
        if kwargs.get("path"):
            args.append("--")
            args.append(kwargs["path"])

        code, stdout, stderr = await _run_git(args, self.project_root)
        if code != 0:
            return f"Error: {stderr.strip()}"
        return stdout.strip() if stdout.strip() else "No differences."


class GitCommitTool(Tool):
    """Create a git commit with a message."""

    name = "git_commit"
    description = "Stage all changes and create a git commit with the given message."
    parameters = {
        "type": "object",
        "properties": {
            "message": {
                "type": "string",
                "description": "The commit message.",
            },
        },
        "required": ["message"],
    }
    requires_confirmation = True

    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root

    async def execute(self, **kwargs: Any) -> str:
        message = kwargs["message"]

        # Stage all changes
        code, _, stderr = await _run_git(["add", "-A"], self.project_root)
        if code != 0:
            return f"Error staging changes: {stderr.strip()}"

        # Commit
        code, stdout, stderr = await _run_git(
            ["commit", "-m", message], self.project_root
        )
        if code != 0:
            return f"Error committing: {stderr.strip()}"
        return stdout.strip()


class GitLogTool(Tool):
    """Show recent git commit history."""

    name = "git_log"
    description = "Show recent git commits. Defaults to the last 10 commits."
    parameters = {
        "type": "object",
        "properties": {
            "n": {
                "type": "integer",
                "description": "Number of commits to show (default 10).",
            },
        },
        "required": [],
    }
    requires_confirmation = False

    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root

    async def execute(self, **kwargs: Any) -> str:
        n = kwargs.get("n", 10)
        code, stdout, stderr = await _run_git(
            ["log", f"-{n}", "--oneline", "--decorate"], self.project_root
        )
        if code != 0:
            return f"Error: {stderr.strip()}"
        return stdout.strip() if stdout.strip() else "No commits yet."


def create_git_tools(project_root: Path) -> list[Tool]:
    """Factory: create all git tools for a project."""
    return [
        GitStatusTool(project_root),
        GitDiffTool(project_root),
        GitCommitTool(project_root),
        GitLogTool(project_root),
    ]
