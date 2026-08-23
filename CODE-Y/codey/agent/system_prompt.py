"""System prompt builder with override chain support.

Override priority: project .codey/system_prompt.md > ~/.codey/system_prompt.md > default
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from codey.tools.registry import ToolRegistry

DEFAULT_PROMPT_PATH = Path(__file__).parent / "prompts" / "default_system_prompt.md"
GLOBAL_PROMPT_PATH = Path.home() / ".codey" / "system_prompt.md"


def build_system_prompt(
    project_root: Path,
    tool_registry: ToolRegistry,
    project_prompt_path: Path | None = None,
) -> str:
    """Build the full system prompt with dynamic context injection.

    Override chain (first found wins):
      1. project_root/.codey/system_prompt.md
      2. ~/.codey/system_prompt.md
      3. Built-in default

    Dynamic context appended:
      - Current working directory
      - Available tools list
      - Current timestamp
    """
    # Resolve prompt template
    prompt_text = _load_prompt_template(project_root, project_prompt_path)

    # Build dynamic context section
    tools_list = tool_registry.list_tools()
    tools_str = ", ".join(tools_list) if tools_list else "(none)"
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    context_section = (
        f"\n\n## Current Context\n"
        f"- Working directory: {project_root}\n"
        f"- Available tools: {tools_str}\n"
        f"- Current time: {now}\n"
    )

    return prompt_text + context_section


def _load_prompt_template(
    project_root: Path,
    project_prompt_path: Path | None = None,
) -> str:
    """Load the system prompt template from the override chain."""
    # 1. Project-level override
    if project_prompt_path and project_prompt_path.exists():
        return project_prompt_path.read_text(encoding="utf-8")

    project_override = project_root / ".codey" / "system_prompt.md"
    if project_override.exists():
        return project_override.read_text(encoding="utf-8")

    # 2. Global override
    if GLOBAL_PROMPT_PATH.exists():
        return GLOBAL_PROMPT_PATH.read_text(encoding="utf-8")

    # 3. Built-in default
    return DEFAULT_PROMPT_PATH.read_text(encoding="utf-8")
