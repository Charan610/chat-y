"""Data-driven registry for CODE-Y slash commands.

Adding a command to this registry automatically makes it available in the
TUI autocomplete popup, CLI REPL, and /help output with zero UI changes.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine


@dataclass
class SlashCommand:
    """A registered slash command."""

    name: str  # e.g., "/model"
    description: str  # Human-readable summary
    usage: str  # e.g., "/model <name>"
    category: str = "General"
    aliases: list[str] = field(default_factory=list)


class SlashCommandRegistry:
    """Central registry of all slash commands."""

    def __init__(self) -> None:
        self._commands: dict[str, SlashCommand] = {}

    def register(self, command: SlashCommand) -> None:
        """Register a new slash command."""
        self._commands[command.name.lower()] = command
        for alias in command.aliases:
            self._commands[alias.lower()] = command

    def get(self, name: str) -> SlashCommand | None:
        """Look up a command by exact name or alias."""
        return self._commands.get(name.lower())

    def list_commands(self) -> list[SlashCommand]:
        """Return all unique registered commands in display order."""
        seen = set()
        unique = []
        for cmd in self._commands.values():
            if cmd.name not in seen:
                seen.add(cmd.name)
                unique.append(cmd)
        return unique

    def filter(self, query: str) -> list[SlashCommand]:
        """Live prefix/fuzzy filter commands matching *query*.

        Matches against command name, aliases, and description.
        Prefix matches are prioritized above substring matches.
        """
        q = query.strip().lower()
        if not q.startswith("/"):
            q = "/" + q

        commands = self.list_commands()
        if q == "/":
            return commands

        exact_prefix = []
        substring_match = []

        for cmd in commands:
            cmd_name = cmd.name.lower()
            # 1. Exact prefix match on name
            if cmd_name.startswith(q):
                exact_prefix.append(cmd)
                continue

            # 2. Match on aliases
            if any(a.lower().startswith(q) for a in cmd.aliases):
                exact_prefix.append(cmd)
                continue

            # 3. Substring match in name or description
            clean_q = q.lstrip("/")
            if clean_q and (clean_q in cmd_name or clean_q in cmd.description.lower()):
                substring_match.append(cmd)

        return exact_prefix + substring_match


# ── Global default registry ──

DEFAULT_SLASH_COMMANDS: list[SlashCommand] = [
    SlashCommand(
        name="/model",
        usage="/model <name>",
        description="Switch the active provider/model for this session",
        category="Session",
    ),
    SlashCommand(
        name="/verbose",
        usage="/verbose",
        description="Toggle raw reasoning and state transition stream",
        category="UI",
    ),
    SlashCommand(
        name="/context",
        usage="/context",
        description="Show current context window usage and token breakdown",
        category="Session",
    ),
    SlashCommand(
        name="/mcp",
        usage="/mcp",
        description="List connected MCP servers and their available tools",
        category="Tools",
    ),
    SlashCommand(
        name="/plugins",
        usage="/plugins",
        description="List installed plugins and extension tools",
        category="Tools",
    ),
    SlashCommand(
        name="/tools",
        usage="/tools",
        description="List all available native, MCP, and plugin tools",
        category="Tools",
    ),
    SlashCommand(
        name="/clear",
        usage="/clear",
        description="Clear the current conversation history",
        category="Session",
    ),
    SlashCommand(
        name="/key",
        usage="/key <provider> <key>",
        description="Set and save provider API key permanently (e.g. /key groq gsk_...)",
        category="Config",
        aliases=["/api", "/auth"],
    ),
    SlashCommand(
        name="/copy",
        usage="/copy",
        description="Copy the last assistant response to clipboard (Ctrl+Y)",
        category="Session",
        aliases=["/c"],
    ),
    SlashCommand(
        name="/help",
        usage="/help",
        description="Show all available slash commands",
        category="General",
        aliases=["/?"],
    ),
]


def create_default_registry() -> SlashCommandRegistry:
    """Create and populate the default slash command registry."""
    reg = SlashCommandRegistry()
    for cmd in DEFAULT_SLASH_COMMANDS:
        reg.register(cmd)
    return reg
