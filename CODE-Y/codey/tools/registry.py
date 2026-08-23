"""Central tool registry that merges native, MCP, and plugin tools.

The agent loop interacts ONLY with the registry — it never needs to know
whether a tool is native, MCP-sourced, or plugin-provided.
"""

from __future__ import annotations

import logging
from typing import Any

from codey.agent.message_types import ToolSchema, ToolFunctionSchema
from codey.tools.base import Tool

logger = logging.getLogger(__name__)


class ToolRegistry:
    """Unified registry for all agent tools.

    Provides:
      - Registration of native Tool instances
      - Schema generation in OpenAI-compatible format
      - Execution dispatch by tool name
      - Extension points for MCP and plugin tools (Phase 3)
    """

    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}
        self._mcp_tools: dict[str, Any] = {}  # Phase 3: MCP tool entries

    def register(self, tool: Tool) -> None:
        """Register a native tool."""
        if tool.name in self._tools:
            logger.warning("Tool '%s' already registered, overwriting.", tool.name)
        self._tools[tool.name] = tool
        logger.debug("Registered tool: %s", tool.name)

    def register_many(self, tools: list[Tool]) -> None:
        """Register multiple native tools at once."""
        for tool in tools:
            self.register(tool)

    def get_tool(self, name: str) -> Tool | None:
        """Look up a tool by name."""
        return self._tools.get(name)

    def get_schemas(self) -> list[ToolSchema]:
        """Return OpenAI-compatible tool schemas for all registered tools."""
        schemas = []
        for tool in self._tools.values():
            schemas.append(
                ToolSchema(
                    function=ToolFunctionSchema(
                        name=tool.name,
                        description=tool.description,
                        parameters=tool.parameters,
                    )
                )
            )
        # Phase 3: append MCP tool schemas here
        return schemas

    async def execute(self, name: str, arguments: dict[str, Any]) -> str:
        """Execute a tool by name with the given arguments.

        Returns the tool's string result, or an error message if the
        tool is not found or execution fails.
        """
        tool = self._tools.get(name)
        if tool is None:
            # Phase 3: check MCP tools
            return f"Error: Unknown tool '{name}'. Available tools: {list(self._tools.keys())}"

        try:
            result = await tool.execute(**arguments)
            return result
        except Exception as e:
            logger.exception("Error executing tool '%s'", name)
            return f"Error executing {name}: {type(e).__name__}: {e}"

    def requires_confirmation(self, name: str) -> bool:
        """Check if a tool requires user confirmation before execution."""
        tool = self._tools.get(name)
        if tool is None:
            return True  # Default to requiring confirmation for unknown tools
        return tool.requires_confirmation

    def list_tools(self) -> list[str]:
        """Return names of all registered tools."""
        return list(self._tools.keys())

    def tool_count(self) -> int:
        """Total number of registered tools (native + MCP + plugin)."""
        return len(self._tools) + len(self._mcp_tools)

    def __repr__(self) -> str:
        return f"<ToolRegistry tools={self.list_tools()}>"
