"""CODE-Y Boxed Terminal UI Application Root.

Matches the reference boxed layout:
╭──────────────────────────────────────────────────────────────╮
│  ✦ CODE-Y                              ● ONLINE   12:43 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Good afternoon, Charan.                                    │
│                                                              │
│  What would you like me to do?                              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ > Build a React dashboard for my project              │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ─── Activity ──────────────────────────────────────────────  │
│                                                              │
│  ◉ Thinking        Analyzing project structure...             │
│  ✓ Search          Found 12 relevant files                    │
│  ✓ Edit            Updated src/components/Dashboard.tsx       │
│  ◌ Execute         Running development server...              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [Tab] Agents   [/] Commands   [↑↓] History   [Esc] Cancel  │
╰──────────────────────────────────────────────────────────────╯
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Vertical
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
from codey.ui.theme import CODEY_ORANGE_THEME, ORANGE, SUCCESS, TEXT_DIM, TEXT_MUTED
from codey.ui.widgets.activity_feed import ActivityFeed
from codey.ui.widgets.diff_view import DiffView
from codey.ui.widgets.footer_keybar import FooterKeybar
from codey.ui.widgets.greeting_area import GreetingArea
from codey.ui.widgets.header_bar import HeaderBar

logger = logging.getLogger(__name__)


class CodeYApp(App):
    """CODE-Y Boxed Terminal UI Application."""

    CSS = """
    Screen {
        background: #0A0A0B;
        padding: 0 1;
        align: center middle;
    }

    #box-frame {
        height: 100%;
        width: 100%;
        background: #0A0A0B;
        border: round #2A2A2E;
        padding: 0;
    }

    #box-frame:focus-within {
        border: round #3A3A40;
    }

    .divider {
        height: 1;
        color: #2A2A2E;
        background: #0A0A0B;
        padding: 0 1;
    }
    """

    BINDINGS = [
        Binding("ctrl+c", "quit", "Quit"),
        Binding("ctrl+l", "clear", "Clear"),
        Binding("ctrl+v", "toggle_verbose", "Verbose"),
        Binding("ctrl+o", "toggle_tool", "Expand Output"),
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
        """Initialize theme, tools, router, and event subscriptions."""
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

        # Update initial footer info
        footer = self.query_one(FooterKeybar)
        footer.update_provider(
            self.router.active_provider.name.upper(),
            self.router.active_provider.model_id,
        )

        # Load plugins
        self.plugin_loader = PluginLoader(registry, self.config)
        self.plugin_loader.discover_and_load()

        # Initialize MCP servers in background
        self.mcp_manager = MCPClientManager(registry)
        self.run_worker(self._init_mcp())

        # Focus input
        self.query_one(InputBar).input_widget.focus()

    async def _init_mcp(self) -> None:
        if self.mcp_manager:
            try:
                await self.mcp_manager.initialize()
            except Exception as e:
                logger.error("MCP initialization failed: %s", e)

    def compose(self) -> ComposeResult:
        with Vertical(id="box-frame"):
            yield HeaderBar()
            yield Static("─" * 400, classes="divider", id="top-divider")
            yield GreetingArea(user_name=self.config.user.name)
            yield InputBar(
                slash_registry=self.slash_registry,
                models_provider=lambda: self.router.get_model_catalog() if self.router else [],
            )
            yield ActivityFeed()
            yield DiffView()
            yield Static("─" * 400, classes="divider", id="bottom-divider")
            yield FooterKeybar()

    def _wire_events(self) -> None:
        """Subscribe UI widgets to event bus notifications."""
        feed = self.query_one(ActivityFeed)
        footer = self.query_one(FooterKeybar)
        header = self.query_one(HeaderBar)
        greeting = self.query_one(GreetingArea)

        # Thinking tokens → activity feed
        self.event_bus.subscribe(Events.THINKING_TOKEN, lambda token, **_: feed.add_thinking_token(token))

        # Tool calls → intent display before execution with ◉ in-progress glyph
        self.event_bus.subscribe(Events.TOOL_CALL_PENDING, feed.add_tool_pending)

        # Tool results → collapsed 1-line summary with ✓ glyph
        self.event_bus.subscribe(Events.TOOL_RESULT, feed.add_tool_result)

        # Response complete
        def on_response(content: str, **_: object):
            feed.add_response(content)
            greeting.clear_task()
            header.set_online()

        self.event_bus.subscribe(Events.RESPONSE_COMPLETE, on_response)

        # Provider failover → inline Failover row + header status update
        def on_failover(from_provider: str, to_provider: str, reason: str, elapsed: float = 0, **_: object):
            header.set_retrying()
            feed.add_failover_row(from_provider, to_provider, reason, elapsed)
            if self.router:
                active = self.router.active_provider
                footer.update_provider(active.name.upper(), active.model_id)

        self.event_bus.subscribe(Events.PROVIDER_FAILOVER, on_failover)

        # Context updates → footer stats
        self.event_bus.subscribe(Events.CONTEXT_UPDATE, footer.update_context)

        # State transitions
        def on_state(new_state: str, **_: object):
            footer.update_state(new_state)
            if new_state == "thinking":
                feed.add_thinking_start()
            elif new_state == "error":
                header.set_offline()

        self.event_bus.subscribe(Events.STATE_CHANGE, on_state)
        self.event_bus.subscribe(Events.ERROR, feed.add_error)

    async def on_input_submitted(self, event: Input.Submitted) -> None:
        """Handle user input submission."""
        user_input = event.value.strip()
        if not user_input:
            return

        input_bar = self.query_one(InputBar)
        event.input.clear()
        input_bar.palette.hide()
        input_bar.add_to_history(user_input)

        # Handle slash commands
        if user_input.startswith("/"):
            self._handle_slash_command(user_input)
            return

        # Set active task in greeting area
        greeting = self.query_one(GreetingArea)
        greeting.set_task(user_input)

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
            feed = self.query_one(ActivityFeed)
            feed.add_error(str(e))
            self.query_one(HeaderBar).set_offline()

    async def _confirmation_callback(self, tool_call: ToolCall, description: str) -> bool:
        """Confirmation for destructive operations."""
        return True

    def _handle_slash_command(self, cmd: str) -> None:
        """Dispatch registered slash commands."""
        feed = self.query_one(ActivityFeed)
        footer = self.query_one(FooterKeybar)
        parts = cmd.strip().split(maxsplit=1)
        command_name = parts[0].lower()
        arg = parts[1] if len(parts) > 1 else ""

        if command_name in ("/help", "/?"):
            commands = self.slash_registry.list_commands()
            lines = [f"\n[{ORANGE}]Available Commands:[/]\n"]
            for c in commands:
                lines.append(f"  [{ORANGE}]{c.usage:<18}[/] [{TEXT_DIM}]{c.description}[/]")
            lines.append("")
            feed.log_widget.write("\n".join(lines))

        elif command_name == "/model":
            if arg.lower() == "test" and self.router:
                feed.log_widget.write(f"\n  [{ORANGE}]⚡ Testing live connectivity to all configured models...[/]\n")
                async def _run_tests():
                    results = await self.router.test_all_models()
                    for r in results:
                        status_glyph = f"[{SUCCESS}]✓[/]" if r["success"] else f"[{ERROR}]✗[/]"
                        feed.log_widget.write(f"    {status_glyph} [{ORANGE}]{r['alias']:<20}[/] {r['message']}")
                    feed.log_widget.write("")
                self.run_worker(_run_tests())

            elif arg and self.router:
                if self.router.set_override(arg):
                    active = self.router.active_provider
                    feed.log_widget.write(
                        f"\n  [{ORANGE}]✓ Switched active provider to {active.display_name()}[/]\n"
                    )
                    footer.update_provider(active.name.upper(), active.model_id)
                else:
                    available = ", ".join(p.model_alias for p in self.router.chain)
                    feed.log_widget.write(
                        f"\n  [{TEXT_DIM}]Model '{arg}' not found. Available aliases: {available}[/]\n"
                    )
            elif self.router:
                catalog = self.router.get_model_catalog()
                feed.log_widget.write(f"\n  [bold {ORANGE}]CONFIGURED PROVIDERS & MODELS:[/]\n")
                for entry in catalog:
                    p_name = entry["provider"].upper()
                    if entry["key_env"]:
                        key_status = f"[{SUCCESS}]✓ Key configured ({entry['key_env']})[/]" if entry["has_key"] else f"[{ERROR}]✗ Key missing: export {entry['key_env']}=...[/]"
                    else:
                        key_status = f"[{SUCCESS}]✓ Local server[/]"

                    feed.log_widget.write(f"  [bold]{p_name}[/] [dim]({entry['base_url']})[/]  {key_status}")
                    for m in entry["models"]:
                        active_badge = f" [bold {ORANGE}]▶ (ACTIVE)[/]" if m["is_active"] else ""
                        chain_badge = f"[{TEXT_MUTED}]in chain[/]" if m["in_chain"] else ""
                        feed.log_widget.write(f"    • [{ORANGE}]{m['alias']:<20}[/] [dim]{m['model_id']:<30}[/] {chain_badge}{active_badge}")
                    feed.log_widget.write("")

                chain_str = " → ".join(p.model_alias for p in self.router.chain)
                feed.log_widget.write(f"  [dim]Failover Chain:[/] [dim]{chain_str}[/dim]")
                feed.log_widget.write(f"  [dim]Usage:[/] [{ORANGE}]/model <alias>[/]  |  [{ORANGE}]/model test[/] (live check)\n")

        elif command_name == "/verbose":
            self._verbose = not self._verbose
            feed.verbose = self._verbose
            feed.log_widget.write(
                f"\n  [{ORANGE}]Verbose stream: {'ON' if self._verbose else 'OFF'}[/]\n"
            )

        elif command_name == "/context" and self.agent:
            usage = self.agent.context_manager.get_usage(self.agent.conversation)
            approx = "≈" if usage["approximate"] else ""
            feed.log_widget.write(
                f"\n  [{ORANGE}]Context Window Usage:[/]\n"
                f"    Used:      {approx}{usage['used']:,} tokens ({usage['percent']:.1f}%)\n"
                f"    Capacity:  {usage['total']:,} tokens\n"
                f"    Messages:  {len(self.agent.conversation)}\n"
            )

        elif command_name == "/tools" and self.agent:
            tools = self.agent.tool_registry.list_tools()
            feed.log_widget.write(f"\n  [{ORANGE}]Registered Tools ({len(tools)}):[/]")
            for name in sorted(tools):
                t = self.agent.tool_registry.get_tool(name)
                desc = t.description[:60] if t else ""
                feed.log_widget.write(f"    • [{ORANGE}]{name:<18}[/] [{TEXT_DIM}]{desc}[/]")
            feed.log_widget.write("")

        elif command_name == "/mcp":
            if self.mcp_manager:
                servers = self.mcp_manager.list_servers()
                if not servers:
                    feed.log_widget.write(f"\n  [{TEXT_DIM}]No MCP servers configured in ~/.codey/mcp_config.yaml[/]\n")
                else:
                    feed.log_widget.write(f"\n  [{ORANGE}]Connected MCP Servers ({len(servers)}):[/]")
                    for s in servers:
                        feed.log_widget.write(f"    • [{ORANGE}]{s['name']}[/] ({s['transport']}) — tools: {', '.join(s['tools'])}")
                    feed.log_widget.write("")
            else:
                feed.log_widget.write(f"\n  [{TEXT_DIM}]MCP Manager not active[/]\n")

        elif command_name == "/plugins":
            if self.plugin_loader:
                plugins = self.plugin_loader.list_plugins()
                if not plugins:
                    feed.log_widget.write(f"\n  [{TEXT_DIM}]No plugins installed in ~/.codey/plugins/[/]\n")
                else:
                    feed.log_widget.write(f"\n  [{ORANGE}]Installed Plugins ({len(plugins)}):[/]")
                    for p in plugins:
                        feed.log_widget.write(f"    • [{ORANGE}]{p['name']}[/] v{p['version']} — {p['description']}")
                    feed.log_widget.write("")

        elif command_name == "/clear" and self.agent:
            self.agent.conversation.clear()
            self.agent._initialized = False
            self.agent.initialize()
            feed.clear()
            feed.log_widget.write(f"\n  [{ORANGE}]✓ Conversation history cleared.[/]\n")

        else:
            feed.log_widget.write(f"\n  [{TEXT_DIM}]Unknown command: {command_name}. Type /help for commands.[/]\n")

    def action_clear(self) -> None:
        self._handle_slash_command("/clear")

    def action_toggle_verbose(self) -> None:
        self._handle_slash_command("/verbose")

    def action_toggle_tool(self) -> None:
        feed = self.query_one(ActivityFeed)
        feed.action_toggle_expansion()
