"""CODE-Y Textual TUI application root.

Full transparency TUI with Orange & Black theme, live streaming,
tool call visibility, context meter, and failover banners.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.widgets import Footer, Header, Input, Static

from codey.agent.context_manager import ContextManager
from codey.agent.loop import AgentLoop, AgentState
from codey.agent.message_types import ToolCall
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
from codey.ui.theme import CODEY_ORANGE_THEME, ORANGE, TEXT_DIM
from codey.ui.widgets.context_meter import ContextMeter
from codey.ui.widgets.diff_view import DiffView
from codey.ui.widgets.provider_banner import ProviderBanner
from codey.ui.widgets.status_rail import StatusRail
from codey.ui.widgets.thought_stream import ThoughtStream

logger = logging.getLogger(__name__)


class CodeYApp(App):
    """CODE-Y Terminal UI Application.

    Layout:
    ┌────────────────────────────────────┬──────────────────────┐
    │  [thought_stream]                  │  [status_rail]       │
    │  + [provider_banner]               │    provider/model    │
    │  + [diff_view]                     │    context_meter     │
    │                                    │    recent tools      │
    ├────────────────────────────────────┴──────────────────────┤
    │  [input_bar]                                              │
    └───────────────────────────────────────────────────────────┘
    """

    CSS = """
    Screen {
        background: $background;
    }

    #main-container {
        height: 1fr;
    }

    #left-pane {
        width: 1fr;
        height: 100%;
    }

    #title-bar {
        height: 1;
        background: $surface;
        color: $primary;
        text-style: bold;
        padding: 0 2;
    }
    """

    BINDINGS = [
        Binding("ctrl+c", "quit", "Quit"),
        Binding("ctrl+l", "clear", "Clear"),
        Binding("ctrl+v", "toggle_verbose", "Verbose"),
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
        self.agent: AgentLoop | None = None
        self.router: ProviderRouter | None = None
        self._verbose = config.ui.verbose_default

    def on_mount(self) -> None:
        """Initialize theme, tools, provider, and agent on mount."""
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

        # Set up router
        self.router = ProviderRouter(self.config, self.event_bus)

        # Set up context manager
        context_manager = ContextManager(self.event_bus)
        context_manager.set_context_size_for_model(self.router.active_provider.model_id)

        # Set up agent
        self.agent = AgentLoop(
            provider=self.router.active_provider,
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

        # Update status rail
        rail = self.query_one(StatusRail)
        rail.update_provider(
            self.router.active_provider.name.upper(),
            self.router.active_provider.model_id,
        )

        # Load plugins
        loader = PluginLoader(registry, self.config)
        loaded = loader.discover_and_load()
        if loaded:
            logger.info("Loaded %d plugins", len(loaded))

        # MCP initialization (async)
        self.run_worker(self._init_mcp(registry))

        # Focus input
        self.query_one(InputBar).get_input().focus()

    async def _init_mcp(self, registry: ToolRegistry) -> None:
        """Initialize MCP servers asynchronously."""
        try:
            mcp_manager = MCPClientManager(registry)
            await mcp_manager.initialize()
        except Exception as e:
            logger.error("MCP initialization failed: %s", e)

    def compose(self) -> ComposeResult:
        yield Static(f" ⚡ CODE-Y — {self.project_root.name}", id="title-bar")
        with Horizontal(id="main-container"):
            with Vertical(id="left-pane"):
                yield ProviderBanner()
                yield ThoughtStream()
                yield DiffView()
            yield StatusRail()
        yield InputBar()

    def _wire_events(self) -> None:
        """Subscribe UI widgets to event bus events."""
        stream = self.query_one(ThoughtStream)
        rail = self.query_one(StatusRail)
        banner = self.query_one(ProviderBanner)
        context_meter = rail.query_one(ContextMeter)
        input_bar = self.query_one(InputBar)

        # Thinking tokens → thought stream
        self.event_bus.subscribe(Events.THINKING_TOKEN, lambda token, **_: stream.add_thinking_token(token))

        # Tool calls → thought stream + status rail
        self.event_bus.subscribe(Events.TOOL_CALL_PENDING, stream.add_tool_call_pending)
        self.event_bus.subscribe(Events.TOOL_CALL_PENDING, lambda tool_name, **_: rail.on_tool_call(tool_name))

        # Tool execution → thought stream
        self.event_bus.subscribe(Events.TOOL_EXECUTING, stream.add_tool_executing)

        # Tool results → thought stream
        self.event_bus.subscribe(Events.TOOL_RESULT, stream.add_tool_result)

        # Response complete → thought stream
        self.event_bus.subscribe(Events.RESPONSE_COMPLETE, lambda content, **_: stream.add_response(content))

        # Provider failover → banner + thought stream + status rail
        self.event_bus.subscribe(Events.PROVIDER_FAILOVER, banner.show_failover)
        self.event_bus.subscribe(Events.PROVIDER_FAILOVER, stream.add_failover_banner)
        self.event_bus.subscribe(Events.PROVIDER_FAILOVER, rail.on_failover)

        # Context updates → context meter
        self.event_bus.subscribe(Events.CONTEXT_UPDATE, context_meter.update_usage)

        # State changes → input bar + thought stream
        self.event_bus.subscribe(
            Events.STATE_CHANGE,
            lambda new_state, **_: setattr(input_bar, "agent_state", new_state),
        )
        self.event_bus.subscribe(Events.STATE_CHANGE, stream.add_state_change)

        # Errors → thought stream
        self.event_bus.subscribe(Events.ERROR, stream.add_error)

    async def on_input_submitted(self, event: Input.Submitted) -> None:
        """Handle user input submission."""
        user_input = event.value.strip()
        if not user_input:
            return

        # Clear input
        event.input.clear()

        # Add to history
        input_bar = self.query_one(InputBar)
        input_bar.add_to_history(user_input)

        # Handle slash commands
        if user_input.startswith("/"):
            self._handle_slash_command(user_input)
            return

        # Display user message
        stream = self.query_one(ThoughtStream)
        stream.add_user_message(user_input)

        # Run agent
        if self.agent:
            self.run_worker(self._run_agent(user_input))

    async def _run_agent(self, user_input: str) -> None:
        """Run agent in background worker."""
        if not self.agent:
            return
        try:
            response = await self.agent.run(user_input)
            # Response is already displayed via event bus
        except Exception as e:
            logger.exception("Agent error")
            stream = self.query_one(ThoughtStream)
            stream.add_error(str(e))

    async def _confirmation_callback(self, tool_call: ToolCall, description: str) -> bool:
        """TUI-based confirmation for tool calls.

        For now, auto-approve in TUI mode. Phase 4+ will show diff_view.
        """
        # TODO: Show diff_view widget for write operations
        return True

    def _handle_slash_command(self, cmd: str) -> None:
        """Handle REPL slash commands in the TUI."""
        stream = self.query_one(ThoughtStream)
        parts = cmd.strip().split(maxsplit=1)
        command = parts[0].lower()
        arg = parts[1] if len(parts) > 1 else ""

        if command == "/help":
            stream.log_widget.write(
                f"\n[{ORANGE}]Commands:[/]\n"
                f"  [{ORANGE}]/model <name>[/]   — switch provider\n"
                f"  [{ORANGE}]/verbose[/]        — toggle verbose output\n"
                f"  [{ORANGE}]/context[/]        — show context usage\n"
                f"  [{ORANGE}]/tools[/]          — list available tools\n"
                f"  [{ORANGE}]/clear[/]          — clear conversation\n"
                f"  [{ORANGE}]Ctrl+C[/]          — exit\n"
            )

        elif command == "/verbose":
            self._verbose = not self._verbose
            stream_widget = self.query_one(ThoughtStream)
            stream_widget.verbose = self._verbose
            stream.log_widget.write(
                f"  [{ORANGE}]Verbose: {'ON' if self._verbose else 'OFF'}[/]"
            )

        elif command == "/context" and self.agent:
            usage = self.agent.context_manager.get_usage(self.agent.conversation)
            approx = "≈" if usage["approximate"] else ""
            stream.log_widget.write(
                f"  Context: {approx}{usage['used']:,} / {usage['total']:,} tokens "
                f"({usage['percent']:.1f}%)\n"
                f"  Messages: {len(self.agent.conversation)}"
            )

        elif command == "/tools" and self.agent:
            tools = self.agent.tool_registry.list_tools()
            stream.log_widget.write(f"  [{ORANGE}]Tools ({len(tools)}):[/]")
            for name in tools:
                stream.log_widget.write(f"    • {name}")

        elif command == "/clear" and self.agent:
            self.agent.conversation.clear()
            self.agent._initialized = False
            self.agent.initialize()
            stream.clear()
            stream.log_widget.write(f"  [{ORANGE}]Conversation cleared.[/]")

        elif command == "/model":
            if arg and self.router:
                if self.router.set_override(arg):
                    stream.log_widget.write(
                        f"  [{ORANGE}]Switched to {self.router.active_provider.display_name()}[/]"
                    )
                    rail = self.query_one(StatusRail)
                    rail.update_provider(
                        self.router.active_provider.name.upper(),
                        self.router.active_provider.model_id,
                    )
                else:
                    stream.log_widget.write(f"  [{TEXT_DIM}]Model '{arg}' not found in chain[/]")
            elif self.router:
                stream.log_widget.write(
                    f"  Current: [{ORANGE}]{self.router.active_provider.display_name()}[/]"
                )

        else:
            stream.log_widget.write(f"  [{TEXT_DIM}]Unknown command: {command}[/]")

    def action_clear(self) -> None:
        """Clear the thought stream."""
        self._handle_slash_command("/clear")

    def action_toggle_verbose(self) -> None:
        """Toggle verbose mode."""
        self._handle_slash_command("/verbose")
