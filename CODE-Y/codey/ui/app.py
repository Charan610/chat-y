"""CODE-Y Textual TUI Application Root.

Features:
  - Claude Code-style live slash-command autocomplete popup
  - Collapsible tool executions with intent preservation (Ctrl+O to expand)
  - Quiet, persistent status line docked above the input bar
  - Smooth append-only flicker-free streaming
  - Phosphor Amber / Orange & Black visual theme
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.widgets import Input, Static

from codey.agent.context_manager import ContextManager
from codey.agent.loop import AgentLoop, AgentState
from codey.agent.message_types import ToolCall
from codey.agent.slash_commands import SlashCommandRegistry, create_default_registry
from codey.config.schema import CodeYConfig
from codey.mcp.client_manager import MCPClientManager
from codey.plugins.plugin_loader import PluginLoader
from codey.providers.router import ProviderRouter
from codey.telemetry.event_bus import EventBus, Events
from codey.tools.fs_tools import create_fs_tools
from codey.tools.git_tools import create_git_tools
from codey.tools.registry import ToolRegistry
from codey.tools.shell_tool import create_shell_tool
from codey.ui.input_bar import InputBar
from codey.ui.theme import CODEY_ORANGE_THEME, ORANGE, TEXT_DIM, TEXT_MUTED
from codey.ui.widgets.diff_view import DiffView
from codey.ui.widgets.provider_banner import ProviderBanner
from codey.ui.widgets.status_line import StatusLine
from codey.ui.widgets.thought_stream import ThoughtStream

logger = logging.getLogger(__name__)


class CodeYApp(App):
    """CODE-Y Terminal UI Application.

    Layout:
    ┌───────────────────────────────────────────────────────────┐
    │  [title_bar] ⚡ CODE-Y — project_name                      │
    ├───────────────────────────────────────────────────────────┤
    │  [thought_stream]                                         │
    │  • User input                                             │
    │  • ⚡ → Intent before execution                           │
    │  • ✓ Collapsed tool results (Ctrl+O to expand)            │
    │  • Assistant streaming response                           │
    │  [diff_view] (on write confirmations)                     │
    ├───────────────────────────────────────────────────────────┤
    │  [status_line] ⚡ nim/deepseek-v4 · ctx 34% · 10 tools    │
    │  [slash_command_palette] (live dropdown on typing '/')    │
    │  [input_bar]                                              │
    └───────────────────────────────────────────────────────────┘
    """

    CSS = """
    Screen {
        background: #0A0A0B;
    }

    #main-container {
        height: 1fr;
        width: 100%;
    }

    #left-pane {
        width: 1fr;
        height: 100%;
    }

    #title-bar {
        height: 1;
        background: #111113;
        color: #FF5F00;
        text-style: bold;
        padding: 0 1;
        border-bottom: solid #1A1A1D;
    }
    """

    BINDINGS = [
        Binding("ctrl+c", "quit", "Quit"),
        Binding("ctrl+l", "clear", "Clear"),
        Binding("ctrl+v", "toggle_verbose", "Verbose"),
        Binding("ctrl+o", "toggle_tool", "Expand Tool"),
    ]

    def __init__(
        self,
        config: CodeYConfig,
        project_root: Path,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self.config = config
        self.project_root = project_root
        self.event_bus = EventBus()
        self.slash_registry = create_default_registry()
        self.agent: AgentLoop | None = None
        self.router: ProviderRouter | None = None
        self.mcp_manager: MCPClientManager | None = None
        self.plugin_loader: PluginLoader | None = None
        self._verbose = config.ui.verbose_default

    def on_mount(self) -> None:
        """Initialize theme, tools, provider router, and event subscriptions."""
        self.register_theme(CODEY_ORANGE_THEME)
        self.theme = "codey_orange"

        # Set up tools
        registry = ToolRegistry()
        registry.register_many(create_fs_tools(self.project_root))
        registry.register(create_shell_tool(
            self.project_root,
            self.config.permissions.shell_allowlist,
            self.config.permissions.auto_approve_shell,
        ))
        registry.register_many(create_git_tools(self.project_root))

        # Set up provider router
        self.router = ProviderRouter(self.config, self.event_bus)

        # Set up context manager
        context_manager = ContextManager(self.event_bus)
        context_manager.set_context_size_for_model(self.router.active_provider.model_id)

        # Set up agent loop
        self.agent = AgentLoop(
            provider=self.router,
            tool_registry=registry,
            event_bus=self.event_bus,
            context_manager=context_manager,
            project_root=self.project_root,
            auto_approve_reads=self.config.permissions.auto_approve_reads,
            auto_approve_writes=self.config.permissions.auto_approve_writes,
            auto_approve_shell=self.config.permissions.auto_approve_shell,
            confirmation_callback=self._confirmation_callback,
        )

        # Wire event bus to widgets
        self._wire_events()

        # Update quiet status line
        status_line = self.query_one(StatusLine)
        status_line.update_provider(
            self.router.active_provider.name.upper(),
            self.router.active_provider.model_id,
        )
        status_line.update_tool_count(registry.tool_count())

        # Load plugins
        self.plugin_loader = PluginLoader(registry, self.config)
        loaded = self.plugin_loader.discover_and_load()
        if loaded:
            logger.info("Loaded %d plugins", len(loaded))
            status_line.update_tool_count(registry.tool_count())

        # Initialize MCP servers asynchronously
        self.mcp_manager = MCPClientManager(registry)
        self.run_worker(self._init_mcp(status_line))

        # Focus input
        self.query_one(InputBar).input_widget.focus()

    async def _init_mcp(self, status_line: StatusLine) -> None:
        """Initialize MCP servers in the background."""
        if self.mcp_manager:
            try:
                await self.mcp_manager.initialize()
                if self.agent:
                    status_line.update_tool_count(self.agent.tool_registry.tool_count())
            except Exception as e:
                logger.error("MCP initialization failed: %s", e)

    def compose(self) -> ComposeResult:
        yield Static(f" ⚡ CODE-Y — {self.project_root.name}", id="title-bar")
        with Horizontal(id="main-container"):
            with Vertical(id="left-pane"):
                yield ProviderBanner()
                yield ThoughtStream()
                yield DiffView()
        yield StatusLine()
        yield InputBar(slash_registry=self.slash_registry)

    def _wire_events(self) -> None:
        """Subscribe UI widgets to event bus notifications."""
        stream = self.query_one(ThoughtStream)
        status_line = self.query_one(StatusLine)
        banner = self.query_one(ProviderBanner)
        input_bar = self.query_one(InputBar)

        # Thinking tokens → thought stream (append-only, flicker-free)
        self.event_bus.subscribe(Events.THINKING_TOKEN, lambda token, **_: stream.add_thinking_token(token))

        # Tool calls → intent display before execution
        self.event_bus.subscribe(Events.TOOL_CALL_PENDING, stream.add_tool_call_pending)

        # Tool execution indicator
        self.event_bus.subscribe(Events.TOOL_EXECUTING, stream.add_tool_executing)

        # Tool results → collapsed 1-line summary
        self.event_bus.subscribe(Events.TOOL_RESULT, stream.add_tool_result)

        # Response complete → thought stream
        self.event_bus.subscribe(Events.RESPONSE_COMPLETE, lambda content, **_: stream.add_response(content))

        # Provider failover → instant status line update + inline banner
        def on_failover(from_provider: str, to_provider: str, reason: str, elapsed: float = 0, **_: object):
            banner.show_failover(from_provider, to_provider, reason, elapsed)
            stream.add_failover_banner(from_provider, to_provider, reason, elapsed)
            if self.router:
                active = self.router.active_provider
                status_line.update_provider(active.name.upper(), active.model_id)

        self.event_bus.subscribe(Events.PROVIDER_FAILOVER, on_failover)

        # Context updates → quiet status line
        self.event_bus.subscribe(Events.CONTEXT_UPDATE, status_line.update_context)

        # State transitions → status line + input bar placeholder
        def on_state(new_state: str, **_: object):
            status_line.update_state(new_state)
            setattr(input_bar, "agent_state", new_state)

        self.event_bus.subscribe(Events.STATE_CHANGE, on_state)
        self.event_bus.subscribe(Events.STATE_CHANGE, stream.add_state_change)

        # Errors → thought stream
        self.event_bus.subscribe(Events.ERROR, stream.add_error)

    async def on_input_submitted(self, event: Input.Submitted) -> None:
        """Handle user input submission."""
        user_input = event.value.strip()
        if not user_input:
            return

        # Clear input box and close palette
        input_bar = self.query_one(InputBar)
        event.input.clear()
        input_bar.palette.hide()
        input_bar.add_to_history(user_input)

        # Handle slash commands
        if user_input.startswith("/"):
            self._handle_slash_command(user_input)
            return

        # Display user message
        stream = self.query_one(ThoughtStream)
        stream.add_user_message(user_input)

        # Run agent in background worker
        if self.agent:
            self.run_worker(self._run_agent(user_input))

    async def _run_agent(self, user_input: str) -> None:
        """Run agent loop in background worker."""
        if not self.agent:
            return
        try:
            await self.agent.run(user_input)
        except Exception as e:
            logger.exception("Agent error")
            stream = self.query_one(ThoughtStream)
            stream.add_error(str(e))

    async def _confirmation_callback(self, tool_call: ToolCall, description: str) -> bool:
        """Confirmation for destructive operations."""
        return True

    def _handle_slash_command(self, cmd: str) -> None:
        """Dispatch registered slash commands."""
        stream = self.query_one(ThoughtStream)
        status_line = self.query_one(StatusLine)
        parts = cmd.strip().split(maxsplit=1)
        command_name = parts[0].lower()
        arg = parts[1] if len(parts) > 1 else ""

        if command_name in ("/help", "/?"):
            commands = self.slash_registry.list_commands()
            lines = [f"\n[{ORANGE}]Available Commands:[/]\n"]
            for c in commands:
                lines.append(f"  [{ORANGE}]{c.usage:<18}[/] [{TEXT_DIM}]{c.description}[/]")
            lines.append("")
            stream.log_widget.write("\n".join(lines))

        elif command_name == "/model":
            if arg and self.router:
                if self.router.set_override(arg):
                    active = self.router.active_provider
                    stream.log_widget.write(
                        f"\n  [{ORANGE}]✓ Switched active provider to {active.display_name()}[/]\n"
                    )
                    status_line.update_provider(active.name.upper(), active.model_id)
                else:
                    available = ", ".join(p.model_alias for p in self.router.chain)
                    stream.log_widget.write(
                        f"\n  [{TEXT_DIM}]Model '{arg}' not found. Available aliases: {available}[/]\n"
                    )
            elif self.router:
                stream.log_widget.write(
                    f"\n  Current provider: [{ORANGE}]{self.router.active_provider.display_name()}[/]\n"
                    f"  Usage: [bold {ORANGE}]/model <alias>[/]\n"
                )

        elif command_name == "/verbose":
            self._verbose = not self._verbose
            stream_widget = self.query_one(ThoughtStream)
            stream_widget.verbose = self._verbose
            stream.log_widget.write(
                f"\n  [{ORANGE}]Verbose stream: {'ON' if self._verbose else 'OFF'}[/]\n"
            )

        elif command_name == "/context" and self.agent:
            usage = self.agent.context_manager.get_usage(self.agent.conversation)
            approx = "≈" if usage["approximate"] else ""
            stream.log_widget.write(
                f"\n  [{ORANGE}]Context Window Usage:[/]\n"
                f"    Used:      {approx}{usage['used']:,} tokens ({usage['percent']:.1f}%)\n"
                f"    Capacity:  {usage['total']:,} tokens\n"
                f"    Messages:  {len(self.agent.conversation)}\n"
            )

        elif command_name == "/tools" and self.agent:
            tools = self.agent.tool_registry.list_tools()
            stream.log_widget.write(f"\n  [{ORANGE}]Registered Tools ({len(tools)}):[/]")
            for name in sorted(tools):
                t = self.agent.tool_registry.get_tool(name)
                desc = t.description[:60] if t else ""
                stream.log_widget.write(f"    • [{ORANGE}]{name:<18}[/] [{TEXT_DIM}]{desc}[/]")
            stream.log_widget.write("")

        elif command_name == "/mcp":
            if self.mcp_manager:
                servers = self.mcp_manager.list_servers()
                if not servers:
                    stream.log_widget.write(f"\n  [{TEXT_DIM}]No MCP servers configured in ~/.codey/mcp_config.yaml[/]\n")
                else:
                    stream.log_widget.write(f"\n  [{ORANGE}]Connected MCP Servers ({len(servers)}):[/]")
                    for s in servers:
                        stream.log_widget.write(f"    • [{ORANGE}]{s['name']}[/] ({s['transport']}) — tools: {', '.join(s['tools'])}")
                    stream.log_widget.write("")
            else:
                stream.log_widget.write(f"\n  [{TEXT_DIM}]MCP Manager not active[/]\n")

        elif command_name == "/plugins":
            if self.plugin_loader:
                plugins = self.plugin_loader.list_plugins()
                if not plugins:
                    stream.log_widget.write(f"\n  [{TEXT_DIM}]No plugins installed in ~/.codey/plugins/[/]\n")
                else:
                    stream.log_widget.write(f"\n  [{ORANGE}]Installed Plugins ({len(plugins)}):[/]")
                    for p in plugins:
                        stream.log_widget.write(f"    • [{ORANGE}]{p['name']}[/] v{p['version']} — {p['description']}")
                    stream.log_widget.write("")

        elif command_name == "/clear" and self.agent:
            self.agent.conversation.clear()
            self.agent._initialized = False
            self.agent.initialize()
            stream.clear()
            stream.log_widget.write(f"\n  [{ORANGE}]✓ Conversation history cleared.[/]\n")

        else:
            stream.log_widget.write(f"\n  [{TEXT_DIM}]Unknown command: {command_name}. Type /help for commands.[/]\n")

    def action_clear(self) -> None:
        """Clear conversation."""
        self._handle_slash_command("/clear")

    def action_toggle_verbose(self) -> None:
        """Toggle verbose mode."""
        self._handle_slash_command("/verbose")

    def action_toggle_tool(self) -> None:
        """Toggle expanding/collapsing the last tool output."""
        stream = self.query_one(ThoughtStream)
        stream.action_toggle_tool_expansion()
