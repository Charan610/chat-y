"""Shell execution tool with allowlist-based auto-approval.

Runs commands via asyncio subprocess with timeout, output truncation,
and configurable confirmation based on the shell_allowlist.
"""

from __future__ import annotations

import asyncio
import shlex
from pathlib import Path
from typing import Any

from codey.tools.base import Tool

# Maximum output chars before truncation
MAX_OUTPUT_CHARS = 10_000
DEFAULT_TIMEOUT = 60


class ShellTool(Tool):
    """Execute shell commands in the project directory."""

    name = "run_command"
    description = (
        "Execute a shell command and return its output. "
        "Commands run in the project root directory. "
        "Destructive commands require user confirmation."
    )
    parameters = {
        "type": "object",
        "properties": {
            "command": {
                "type": "string",
                "description": "The shell command to execute.",
            },
            "cwd": {
                "type": "string",
                "description": "Working directory (relative to project root). Defaults to project root.",
            },
        },
        "required": ["command"],
    }
    requires_confirmation = True  # Default; overridden by allowlist logic

    def __init__(
        self,
        project_root: Path,
        shell_allowlist: list[str] | None = None,
        auto_approve_shell: bool = False,
        timeout: int = DEFAULT_TIMEOUT,
    ) -> None:
        self.project_root = project_root
        self.shell_allowlist = shell_allowlist or []
        self.auto_approve_shell = auto_approve_shell
        self.timeout = timeout

    def is_auto_approved(self, command: str) -> bool:
        """Check if a command is auto-approved based on the allowlist.

        A command is auto-approved if:
          - auto_approve_shell is True globally, OR
          - The command's binary (first token) is in the shell_allowlist
        """
        if self.auto_approve_shell:
            return True

        try:
            tokens = shlex.split(command)
        except ValueError:
            return False

        if not tokens:
            return False

        binary = Path(tokens[0]).name  # handle paths like /usr/bin/git
        return binary in self.shell_allowlist

    async def execute(self, **kwargs: Any) -> str:
        command = kwargs["command"]
        cwd_raw = kwargs.get("cwd")

        # Resolve working directory
        if cwd_raw:
            cwd = self.project_root / cwd_raw
        else:
            cwd = self.project_root

        if not cwd.exists():
            return f"Error: Working directory does not exist: {cwd}"

        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                cwd=str(cwd),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(), timeout=self.timeout
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                return (
                    f"Error: Command timed out after {self.timeout}s.\n"
                    f"Command: {command}"
                )

            exit_code = proc.returncode
            stdout_str = stdout.decode("utf-8", errors="replace") if stdout else ""
            stderr_str = stderr.decode("utf-8", errors="replace") if stderr else ""

            # Truncate long output
            output_parts = []
            if stdout_str:
                if len(stdout_str) > MAX_OUTPUT_CHARS:
                    stdout_str = stdout_str[:MAX_OUTPUT_CHARS] + "\n... [output truncated]"
                output_parts.append(stdout_str)
            if stderr_str:
                if len(stderr_str) > MAX_OUTPUT_CHARS:
                    stderr_str = stderr_str[:MAX_OUTPUT_CHARS] + "\n... [stderr truncated]"
                output_parts.append(f"STDERR:\n{stderr_str}")

            output = "\n".join(output_parts) if output_parts else "(no output)"
            status = "✓" if exit_code == 0 else "✗"

            return f"[{status} exit={exit_code}] $ {command}\n{output}"

        except Exception as e:
            return f"Error executing command: {e}\nCommand: {command}"


def create_shell_tool(
    project_root: Path,
    shell_allowlist: list[str] | None = None,
    auto_approve_shell: bool = False,
) -> ShellTool:
    """Factory: create the shell tool with project-specific config."""
    return ShellTool(
        project_root=project_root,
        shell_allowlist=shell_allowlist,
        auto_approve_shell=auto_approve_shell,
    )
