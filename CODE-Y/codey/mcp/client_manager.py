"""MCP client manager — spawns/connects MCP servers and registers their tools.

Reads mcp_config.yaml in the same shape as Claude Desktop's mcpServers
format so existing configs are portable.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any

import yaml

from codey.tools.base import Tool
from codey.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

# Config file locations
GLOBAL_MCP_CONFIG = Path.home() / ".codey" / "mcp_config.yaml"
DEFAULT_MCP_CONFIG = Path(__file__).parent / "mcp_config.yaml"


class MCPTool(Tool):
    """A tool discovered from an MCP server.

    Wraps the MCP tools/call interface so the agent loop treats it
    identically to native tools.
    """

    def __init__(
        self,
        name: str,
        description: str,
        parameters: dict[str, Any],
        server_name: str,
        session: Any,  # mcp.ClientSession
    ) -> None:
        self.name = name
        self.description = description
        self.parameters = parameters
        self.requires_confirmation = False
        self._server_name = server_name
        self._session = session

    async def execute(self, **kwargs: Any) -> str:
        """Execute this tool via the MCP server."""
        try:
            from mcp.types import CallToolResult

            result = await self._session.call_tool(self.name, kwargs)

            # Extract text content from result
            if hasattr(result, "content") and result.content:
                parts = []
                for block in result.content:
                    if hasattr(block, "text"):
                        parts.append(block.text)
                    elif hasattr(block, "data"):
                        parts.append(f"[binary data: {len(block.data)} bytes]")
                    else:
                        parts.append(str(block))
                return "\n".join(parts)

            return str(result)
        except Exception as e:
            logger.exception("MCP tool '%s' execution failed", self.name)
            return f"Error executing MCP tool '{self.name}': {e}"


class MCPServerConnection:
    """Represents a connection to a single MCP server."""

    def __init__(self, name: str, config: dict[str, Any]) -> None:
        self.name = name
        self.config = config
        self.session: Any = None
        self.tools: list[MCPTool] = []
        self._client: Any = None
        self._read: Any = None
        self._write: Any = None
        self._context_managers: list[Any] = []

    @property
    def is_stdio(self) -> bool:
        return "command" in self.config

    @property
    def is_sse(self) -> bool:
        return "url" in self.config

    async def connect(self) -> None:
        """Establish connection to the MCP server."""
        try:
            if self.is_stdio:
                await self._connect_stdio()
            elif self.is_sse:
                await self._connect_sse()
            else:
                logger.warning(
                    "MCP server '%s' has no 'command' or 'url' — skipping", self.name
                )
                return

            # Discover tools
            await self._discover_tools()

        except Exception as e:
            logger.error("Failed to connect to MCP server '%s': %s", self.name, e)

    async def _connect_stdio(self) -> None:
        """Connect via stdio transport (local subprocess)."""
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        command = self.config["command"]
        args = self.config.get("args", [])
        env_overrides = self.config.get("env", {})

        # Build environment
        env = {**os.environ, **env_overrides}

        server_params = StdioServerParameters(
            command=command,
            args=args,
            env=env,
        )

        # Create stdio client context
        stdio_ctx = stdio_client(server_params)
        transport = await stdio_ctx.__aenter__()
        self._context_managers.append(stdio_ctx)

        read, write = transport
        self._read = read
        self._write = write

        session_ctx = ClientSession(read, write)
        self.session = await session_ctx.__aenter__()
        self._context_managers.append(session_ctx)

        await self.session.initialize()
        logger.info("Connected to MCP server '%s' via stdio", self.name)

    async def _connect_sse(self) -> None:
        """Connect via SSE/HTTP transport (remote server)."""
        from mcp import ClientSession
        from mcp.client.sse import sse_client

        url = self.config["url"]
        headers = self.config.get("headers", {})

        sse_ctx = sse_client(url, headers=headers)
        transport = await sse_ctx.__aenter__()
        self._context_managers.append(sse_ctx)

        read, write = transport
        self._read = read
        self._write = write

        session_ctx = ClientSession(read, write)
        self.session = await session_ctx.__aenter__()
        self._context_managers.append(session_ctx)

        await self.session.initialize()
        logger.info("Connected to MCP server '%s' via SSE at %s", self.name, url)

    async def _discover_tools(self) -> None:
        """Call tools/list and build MCPTool wrappers."""
        if not self.session:
            return

        result = await self.session.list_tools()

        self.tools = []
        for tool_info in result.tools:
            # Convert MCP tool schema to our format
            parameters = {}
            if hasattr(tool_info, "inputSchema") and tool_info.inputSchema:
                parameters = tool_info.inputSchema
            elif hasattr(tool_info, "input_schema") and tool_info.input_schema:
                parameters = tool_info.input_schema

            mcp_tool = MCPTool(
                name=tool_info.name,
                description=tool_info.description or f"MCP tool from {self.name}",
                parameters=parameters if isinstance(parameters, dict) else {},
                server_name=self.name,
                session=self.session,
            )
            self.tools.append(mcp_tool)

        logger.info(
            "Discovered %d tools from MCP server '%s': %s",
            len(self.tools),
            self.name,
            [t.name for t in self.tools],
        )

    async def disconnect(self) -> None:
        """Clean up the MCP server connection."""
        for ctx in reversed(self._context_managers):
            try:
                await ctx.__aexit__(None, None, None)
            except Exception:
                pass
        self._context_managers.clear()
        self.session = None
        logger.info("Disconnected from MCP server '%s'", self.name)


class MCPClientManager:
    """Manages all MCP server connections.

    On startup:
      1. Reads mcp_config.yaml
      2. Spawns/connects each configured server
      3. Discovers tools from each server
      4. Registers all discovered tools into the shared ToolRegistry
    """

    def __init__(self, tool_registry: ToolRegistry) -> None:
        self.tool_registry = tool_registry
        self.connections: dict[str, MCPServerConnection] = {}

    async def initialize(self, config_path: Path | None = None) -> None:
        """Load MCP config and connect to all configured servers."""
        config = self._load_config(config_path)

        servers = config.get("mcpServers", {})
        if not servers:
            logger.debug("No MCP servers configured")
            return

        logger.info("Connecting to %d MCP server(s)...", len(servers))

        for name, server_config in servers.items():
            conn = MCPServerConnection(name, server_config)
            await conn.connect()

            if conn.tools:
                self.connections[name] = conn
                # Register all discovered tools
                for tool in conn.tools:
                    self.tool_registry.register(tool)
                    logger.debug("Registered MCP tool: %s (from %s)", tool.name, name)

        logger.info(
            "MCP initialization complete: %d servers, %d tools",
            len(self.connections),
            sum(len(c.tools) for c in self.connections.values()),
        )

    async def shutdown(self) -> None:
        """Disconnect from all MCP servers."""
        for name, conn in self.connections.items():
            await conn.disconnect()
        self.connections.clear()

    def _load_config(self, config_path: Path | None = None) -> dict[str, Any]:
        """Load MCP configuration file."""
        # Check custom path first
        if config_path and config_path.exists():
            with open(config_path) as f:
                return yaml.safe_load(f) or {}

        # Global config
        if GLOBAL_MCP_CONFIG.exists():
            with open(GLOBAL_MCP_CONFIG) as f:
                return yaml.safe_load(f) or {}

        # Default (empty)
        with open(DEFAULT_MCP_CONFIG) as f:
            return yaml.safe_load(f) or {}

    def list_servers(self) -> list[dict[str, Any]]:
        """List connected MCP servers and their tools."""
        servers = []
        for name, conn in self.connections.items():
            servers.append({
                "name": name,
                "transport": "stdio" if conn.is_stdio else "sse",
                "tools": [t.name for t in conn.tools],
                "connected": conn.session is not None,
            })
        return servers
