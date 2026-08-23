"""CODE-Y CLI entrypoint.

Phase 1: Plain Rich console REPL with single-provider support.
Phase 4: Full Textual TUI will replace the REPL.
"""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt
from rich.text import Text

from codey import __version__
from codey.agent.context_manager import ContextManager
from codey.agent.loop import AgentLoop, AgentState
from codey.agent.message_types import ToolCall
from codey.config.loader import load_config, ensure_global_config_dir
from codey.config.schema import CodeYConfig
from codey.providers.router import ProviderRouter
from codey.telemetry.event_bus import EventBus, Events
from codey.tools.fs_tools import create_fs_tools
from codey.tools.git_tools import create_git_tools
from codey.tools.registry import ToolRegistry
from codey.tools.shell_tool import create_shell_tool

# ── Theme colors ──
ORANGE = "#FF5F00"
BLACK = "#0A0A0B"
DIM = "#666666"
WHITE = "#E0E0E0"
SUCCESS = "#4E9A06"
ERROR = "#CC0000"

app = typer.Typer(
    name="codey",
    help="CODE-Y: Terminal-native AI coding agent",
    no_args_is_help=True,
    rich_markup_mode="rich",
)

console = Console()


def _print_banner() -> None:
    """Print the CODE-Y startup banner."""
    banner = Text()
    banner.append("  ╔═══════════════════════════════════╗\n", style=f"bold {ORANGE}")
    banner.append("  ║", style=f"bold {ORANGE}")
    banner.append("         CODE-Y  v" + __version__, style=f"bold {ORANGE}")
    banner.append("         ║\n", style=f"bold {ORANGE}")
    banner.append("  ║", style=f"bold {ORANGE}")
    banner.append("   Terminal AI Coding Agent   ", style=f"{DIM}")
    banner.append("  ║\n", style=f"bold {ORANGE}")
    banner.append("  ╚═══════════════════════════════════╝", style=f"bold {ORANGE}")
    console.print(banner)
    console.print()


def _setup_router(config: CodeYConfig, event_bus: EventBus) -> ProviderRouter:
    """Set up the provider router with automatic failover."""
    try:
        router = ProviderRouter(config, event_bus)
    except ValueError as e:
        console.print(f"[bold red]Error:[/] {e}")
        raise typer.Exit(1)

    active = router.active_provider
    console.print(
        f"  [dim]Provider:[/] [{ORANGE}]{active.name.upper()}[/] "
        f"[dim]Model:[/] [{ORANGE}]{active.model_id}[/]"
    )
    chain_str = " → ".join(p.model_alias for p in router.chain)
    console.print(
        f"  [dim]Chain:[/]    [dim]{chain_str}[/dim]"
    )
    return router


def _setup_tools(config: CodeYConfig, project_root: Path) -> ToolRegistry:
    """Create and register all native tools."""
    registry = ToolRegistry()

    # Filesystem tools
    registry.register_many(create_fs_tools(project_root))

    # Shell tool
    shell = create_shell_tool(
        project_root=project_root,
        shell_allowlist=config.permissions.shell_allowlist,
        auto_approve_shell=config.permissions.auto_approve_shell,
    )
    registry.register(shell)

    # Git tools
    registry.register_many(create_git_tools(project_root))

    console.print(f"  [dim]Tools:[/]   [{ORANGE}]{registry.tool_count()}[/] registered")
    return registry


async def _confirmation_callback(tool_call: ToolCall, description: str) -> bool:
    """Rich-based confirmation prompt for tool calls."""
    console.print()
    console.print(
        Panel(
            f"[bold {ORANGE}]⚡ {description}[/]",
            title="[bold]Confirm Tool Call[/]",
            border_style=ORANGE,
            padding=(0, 2),
        )
    )

    # Show arguments for transparency
    if tool_call.name in ("write_file", "edit_file"):
        content = tool_call.arguments.get("content") or tool_call.arguments.get("new_content", "")
        if content:
            preview = content[:500]
            if len(content) > 500:
                preview += "\n... (truncated)"
            console.print(f"  [dim]{preview}[/]")

    response = Prompt.ask(
        f"  [{ORANGE}]Execute?[/]",
        choices=["y", "n"],
        default="y",
    )
    return response.lower() == "y"


async def _run_repl(config: CodeYConfig, project_root: Path) -> None:
    """Run the interactive REPL loop."""
    _print_banner()

    console.print(f"  [dim]Project:[/] [{ORANGE}]{project_root}[/]")

    # Setup
    event_bus = EventBus()
    router = _setup_router(config, event_bus)
    registry = _setup_tools(config, project_root)

    context_manager = ContextManager(
        event_bus=event_bus,
        max_context_tokens=128_000,
    )
    context_manager.set_context_size_for_model(router.active_provider.model_id)

    agent = AgentLoop(
        provider=router,
        tool_registry=registry,
        event_bus=event_bus,
        context_manager=context_manager,
        project_root=project_root,
        auto_approve_reads=config.permissions.auto_approve_reads,
        auto_approve_writes=config.permissions.auto_approve_writes,
        auto_approve_shell=config.permissions.auto_approve_shell,
        confirmation_callback=_confirmation_callback,
    )

    # Subscribe to events for console output
    def on_tool_pending(tool_name: str, tool_args: dict, **_: object) -> None:
        args_preview = ", ".join(f"{k}={repr(v)[:50]}" for k, v in tool_args.items())
        console.print(f"  [{ORANGE}]→ {tool_name}[/]({args_preview})")

    def on_tool_result(tool_name: str, result_preview: str, **_: object) -> None:
        console.print(f"  [dim]← {tool_name}: {result_preview[:100]}[/]")

    def on_error(error: str, **_: object) -> None:
        console.print(f"  [bold red]✗ {error}[/]")

    def on_failover(from_provider: str, to_provider: str, reason: str, **_: object) -> None:
        console.print(f"  [bold {ORANGE}]⚠ {from_provider} {reason} → switching to {to_provider}[/]")

    def on_context_update(used: int, total: int, percent: float, **_: object) -> None:
        # Shown inline with prompt
        pass

    event_bus.subscribe(Events.TOOL_CALL_PENDING, on_tool_pending)
    event_bus.subscribe(Events.TOOL_RESULT, on_tool_result)
    event_bus.subscribe(Events.ERROR, on_error)
    event_bus.subscribe(Events.PROVIDER_FAILOVER, on_failover)
    event_bus.subscribe(Events.CONTEXT_UPDATE, on_context_update)

    console.print()
    console.print(f"  [dim]Type your request. Use /help for commands. Ctrl+C to exit.[/]")
    console.print()

    while True:
        try:
            # Get context info for prompt
            usage = context_manager.get_usage(agent.conversation)
            pct = usage["percent"]
            approx = "≈" if usage["approximate"] else ""

            prompt_text = f"[bold {ORANGE}]codey[/] [{DIM}]{approx}{pct:.0f}%[/] [bold {ORANGE}]>[/] "
            user_input = Prompt.ask(prompt_text)

            if not user_input.strip():
                continue

            # Handle slash commands
            if user_input.startswith("/"):
                handled = _handle_slash_command(user_input, agent, config, router)
                if handled:
                    continue

            # Run agent
            console.print()
            response = await agent.run(user_input)

            if response:
                console.print()
                console.print(Markdown(response))
            console.print()

        except KeyboardInterrupt:
            console.print(f"\n  [{ORANGE}]Goodbye![/]")
            break
        except EOFError:
            break


def _handle_slash_command(
    cmd: str,
    agent: AgentLoop,
    config: CodeYConfig,
    router: ProviderRouter | None = None,
) -> bool:
    """Handle REPL slash commands using the shared SlashCommandRegistry."""
    from codey.agent.slash_commands import create_default_registry

    registry = create_default_registry()
    parts = cmd.strip().split(maxsplit=1)
    command_name = parts[0].lower()
    arg = parts[1] if len(parts) > 1 else ""

    if command_name in ("/help", "/?"):
        commands = registry.list_commands()
        help_lines = []
        for c in commands:
            help_lines.append(f"[bold {ORANGE}]{c.usage:<18}[/] — {c.description}")
        console.print(
            Panel(
                "\n".join(help_lines),
                title="Commands",
                border_style=ORANGE,
            )
        )
        return True

    elif command_name == "/context":
        usage = agent.context_manager.get_usage(agent.conversation)
        approx = "≈" if usage["approximate"] else ""
        pct = usage["percent"]
        bar_width = 30
        filled = int(bar_width * pct / 100)
        bar = "█" * filled + "░" * (bar_width - filled)

        color = ORANGE if pct > 60 else (DIM if pct < 30 else WHITE)
        console.print(
            f"  Context: [{color}]{bar}[/] {approx}{usage['used']:,} / {usage['total']:,} tokens ({pct:.1f}%)"
        )
        console.print(f"  Messages: {len(agent.conversation)}")
        return True

    elif command_name == "/tools":
        tools = agent.tool_registry.list_tools()
        console.print(f"  [{ORANGE}]Available tools ({len(tools)}):[/]")
        for name in sorted(tools):
            tool = agent.tool_registry.get_tool(name)
            desc = f" — {tool.description[:60]}" if tool else ""
            console.print(f"    • [{ORANGE}]{name:<18}[/] [{DIM}]{desc}[/]")
        return True

    elif command_name == "/mcp":
        from codey.mcp.client_manager import GLOBAL_MCP_CONFIG
        import yaml
        if GLOBAL_MCP_CONFIG.exists():
            with open(GLOBAL_MCP_CONFIG) as f:
                data = yaml.safe_load(f) or {}
            servers = data.get("mcpServers", {})
            if servers:
                console.print(f"  [{ORANGE}]Configured MCP Servers ({len(servers)}):[/]")
                for name, s_cfg in servers.items():
                    cmd = s_cfg.get("command") or s_cfg.get("url", "unknown")
                    console.print(f"    • [{ORANGE}]{name}[/] ({cmd})")
            else:
                console.print(f"  [dim]No MCP servers configured in ~/.codey/mcp_config.yaml[/]")
        else:
            console.print(f"  [dim]No MCP servers configured in ~/.codey/mcp_config.yaml[/]")
        return True

    elif command_name == "/plugins":
        from codey.plugins.plugin_loader import PLUGINS_DIR
        if PLUGINS_DIR.exists():
            plugins = [d.name for d in PLUGINS_DIR.iterdir() if d.is_dir()]
            if plugins:
                console.print(f"  [{ORANGE}]Installed Plugins ({len(plugins)}):[/]")
                for p in plugins:
                    console.print(f"    • [{ORANGE}]{p}[/]")
            else:
                console.print(f"  [dim]No plugins found in ~/.codey/plugins/[/]")
        else:
            console.print(f"  [dim]No plugins directory found at ~/.codey/plugins/[/]")
        return True

    elif command_name == "/clear":
        agent.conversation.clear()
        agent._initialized = False
        agent.initialize()
        console.print(f"  [{ORANGE}]✓ Conversation cleared.[/]")
        return True

    elif command_name in ("/exit", "/quit"):
        raise KeyboardInterrupt

    elif command_name == "/model":
        if arg.lower() == "test" and router:
            console.print(f"\n  [bold {ORANGE}]Testing live connectivity to all configured models...[/]\n")
            import asyncio
            results = asyncio.run(router.test_all_models())
            for r in results:
                status_icon = f"[{SUCCESS}]✓[/]" if r["success"] else f"[{ERROR}]✗[/]"
                latency_str = f"({r['latency']:.2f}s)" if r["success"] else ""
                console.print(f"    {status_icon} [{ORANGE}]{r['alias']:<20}[/] {r['message']}")
            console.print()
            return True

        elif arg and router:
            if router.set_override(arg):
                active = router.active_provider
                agent.provider = active
                agent.context_manager.set_context_size_for_model(active.model_id)
                console.print(f"\n  [{ORANGE}]✓ Switched active provider to {active.display_name()}[/]\n")
            else:
                available = ", ".join(p.model_alias for p in router.chain)
                console.print(f"  [dim]Model '{arg}' not found. Available aliases: {available}[/]")
            return True

        elif router:
            catalog = router.get_model_catalog()
            console.print(f"\n  [bold {ORANGE}]AVAILABLE PROVIDERS & MODELS[/]\n")

            for entry in catalog:
                p_name = entry["provider"].upper()
                if entry["key_env"]:
                    key_status = f"[{SUCCESS}]✓ Key set ({entry['key_env']})[/]" if entry["has_key"] else f"[{ERROR}]✗ Key missing: export {entry['key_env']}=...[/]"
                else:
                    key_status = f"[{SUCCESS}]✓ Local server (no key needed)[/]"

                console.print(f"  [bold]{p_name}[/] [dim]({entry['base_url']})[/]  {key_status}")

                for m in entry["models"]:
                    active_badge = f" [bold {ORANGE}]▶ (ACTIVE)[/]" if m["is_active"] else ""
                    chain_badge = f"[{DIM}]in failover chain[/]" if m["in_chain"] else ""
                    console.print(f"    • [{ORANGE}]{m['alias']:<20}[/] [dim]{m['model_id']:<32}[/] {chain_badge}{active_badge}")
                console.print()

            chain_str = " → ".join(p.model_alias for p in router.chain)
            console.print(f"  [dim]Failover Chain:[/] [dim]{chain_str}[/dim]")
            console.print(f"  [dim]Usage:[/] [{ORANGE}]/model <alias>[/]  |  [{ORANGE}]/model test[/] (verify live connectivity)\n")
        return True

    elif command_name == "/verbose":
        console.print(f"  [dim]Verbose toggle active. Use --verbose on launch or /verbose in TUI.[/]")
        return True

    else:
        console.print(f"  [dim]Unknown command: {command_name}. Type /help for available commands.[/]")
        return True


# ── Typer commands ──


@app.command()
def chat(
    project_dir: Optional[str] = typer.Option(
        None, "--project", "-p", help="Project directory (defaults to CWD)"
    ),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable verbose logging"),
    plain: bool = typer.Option(False, "--plain", help="Run in plain console mode instead of full Textual TUI"),
) -> None:
    """Launch the interactive CODE-Y terminal UI."""
    if verbose:
        logging.basicConfig(level=logging.DEBUG, format="%(name)s: %(message)s")
    else:
        logging.basicConfig(level=logging.WARNING)

    project_root = Path(project_dir) if project_dir else Path.cwd()
    if not project_root.exists():
        console.print(f"[bold red]Error:[/] Project directory does not exist: {project_root}")
        raise typer.Exit(1)

    config = load_config(project_root)

    if not plain:
        from codey.ui.app import CodeYApp
        app = CodeYApp(config=config, project_root=project_root)
        app.run()
    else:
        asyncio.run(_run_repl(config, project_root))


@app.command()
def run(
    task: str = typer.Argument(..., help="Task description for one-shot execution"),
    project_dir: Optional[str] = typer.Option(
        None, "--project", "-p", help="Project directory (defaults to CWD)"
    ),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable verbose logging"),
) -> None:
    """Execute a one-shot task non-interactively."""
    if verbose:
        logging.basicConfig(level=logging.DEBUG, format="%(name)s: %(message)s")
    else:
        logging.basicConfig(level=logging.WARNING)

    project_root = Path(project_dir) if project_dir else Path.cwd()
    config = load_config(project_root)

    async def _run_oneshot() -> None:
        event_bus = EventBus()
        router = _setup_router(config, event_bus)
        registry = _setup_tools(config, project_root)
        context_manager = ContextManager(event_bus=event_bus)
        context_manager.set_context_size_for_model(router.active_provider.model_id)

        agent = AgentLoop(
            provider=router,
            tool_registry=registry,
            event_bus=event_bus,
            context_manager=context_manager,
            project_root=project_root,
            auto_approve_reads=config.permissions.auto_approve_reads,
            auto_approve_writes=config.permissions.auto_approve_writes,
            auto_approve_shell=config.permissions.auto_approve_shell,
        )

        # Event handlers for one-shot output
        def on_tool(tool_name: str, **_: object) -> None:
            console.print(f"  [{ORANGE}]→ {tool_name}[/]")

        event_bus.subscribe(Events.TOOL_EXECUTING, on_tool)

        response = await agent.run(task)
        if response:
            console.print(Markdown(response))

    asyncio.run(_run_oneshot())


@app.command()
def init() -> None:
    """Initialize CODE-Y configuration for the current project."""
    project_root = Path.cwd()
    config_path = project_root / ".codey.yaml"

    if config_path.exists():
        console.print(f"[bold {ORANGE}].codey.yaml[/] already exists in this project.")
        return

    # Create project config
    config_path.write_text(
        "# CODE-Y project configuration\n"
        "# Override global settings here\n\n"
        "# permissions:\n"
        "#   auto_approve_writes: false\n"
        "#   auto_approve_shell: false\n",
        encoding="utf-8",
    )
    console.print(f"[bold {ORANGE}]✓[/] Created .codey.yaml")

    # Ensure global config
    global_dir = ensure_global_config_dir()
    global_config = global_dir / "config.yaml"
    if not global_config.exists():
        from codey.config.loader import DEFAULT_CONFIG_PATH
        import shutil
        shutil.copy2(DEFAULT_CONFIG_PATH, global_config)
        console.print(f"[bold {ORANGE}]✓[/] Created ~/.codey/config.yaml")
        console.print(f"  [dim]Set your API keys in environment variables:[/]")
        console.print(f"    export NVIDIA_API_KEY=your-key")
        console.print(f"    export GROQ_API_KEY=your-key")
        console.print(f"    export GEMINI_API_KEY=your-key")
    else:
        console.print(f"  [dim]Global config already exists at {global_config}[/]")

    console.print(f"\n[bold {ORANGE}]Ready![/] Run [bold]codey chat[/] to start.")


@app.command()
def version() -> None:
    """Show CODE-Y version."""
    console.print(f"CODE-Y v{__version__}")


# ── Plugin subcommands ──
plugin_app = typer.Typer(name="plugin", help="Manage CODE-Y plugins")
app.add_typer(plugin_app, name="plugin")


@plugin_app.command("install")
def plugin_install(
    src: str = typer.Argument(..., help="Path or git URL to the plugin"),
) -> None:
    """Install a plugin from a local directory or git URL."""
    from codey.plugins.plugin_loader import install_plugin

    console.print(f"Installing plugin from [{ORANGE}]{src}[/]...")
    success = install_plugin(src)
    if success:
        console.print(f"[bold {ORANGE}]✓[/] Plugin installed successfully to ~/.codey/plugins/")
    else:
        console.print(f"[bold red]✗[/] Failed to install plugin from {src}")
        raise typer.Exit(1)


# ── MCP subcommands ──
mcp_app = typer.Typer(name="mcp", help="Manage MCP server connections")
app.add_typer(mcp_app, name="mcp")


@mcp_app.command("add")
def mcp_add(
    name: str = typer.Argument(..., help="Server name"),
    command: str = typer.Argument(..., help="Command to run the server"),
    args: list[str] = typer.Option(None, "--arg", "-a", help="Arguments to pass to the command"),
) -> None:
    """Add an MCP server to configuration."""
    import yaml
    from codey.mcp.client_manager import GLOBAL_MCP_CONFIG

    GLOBAL_MCP_CONFIG.parent.mkdir(parents=True, exist_ok=True)
    current_config = {"mcpServers": {}}
    if GLOBAL_MCP_CONFIG.exists():
        with open(GLOBAL_MCP_CONFIG) as f:
            current_config = yaml.safe_load(f) or {"mcpServers": {}}

    current_config.setdefault("mcpServers", {})[name] = {
        "command": command,
        "args": args or [],
    }

    with open(GLOBAL_MCP_CONFIG, "w") as f:
        yaml.safe_dump(current_config, f)

    console.print(f"[bold {ORANGE}]✓[/] Added MCP server [{ORANGE}]{name}[/] ({command}) to ~/.codey/mcp_config.yaml")


# ── Auth / API Key subcommands ──
auth_app = typer.Typer(name="auth", help="Manage LLM provider API keys")
app.add_typer(auth_app, name="auth")

PROVIDER_ENV_MAP = {
    "groq": "GROQ_API_KEY",
    "nim": "NVIDIA_API_KEY",
    "nvidia": "NVIDIA_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "google": "GEMINI_API_KEY",
    "openai": "OPENAI_API_KEY",
}


@auth_app.command("set")
def auth_set(
    provider: str = typer.Argument(..., help="Provider name (groq, nim, gemini, etc.)"),
    api_key: str = typer.Argument(..., help="Your API key string"),
) -> None:
    """Set and store an API key permanently in ~/.codey/.env."""
    from codey.config.loader import GLOBAL_ENV_FILE, ensure_global_config_dir

    p_norm = provider.lower().strip()
    env_var = PROVIDER_ENV_MAP.get(p_norm, f"{p_norm.upper()}_API_KEY")

    ensure_global_config_dir()
    lines = []
    found = False

    if GLOBAL_ENV_FILE.exists():
        with open(GLOBAL_ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip().startswith(f"{env_var}="):
                    lines.append(f"{env_var}=\"{api_key}\"\n")
                    found = True
                else:
                    lines.append(line)

    if not found:
        lines.append(f"{env_var}=\"{api_key}\"\n")

    with open(GLOBAL_ENV_FILE, "w", encoding="utf-8") as f:
        f.writelines(lines)

    # Also update current process env
    import os
    os.environ[env_var] = api_key

    masked = api_key[:4] + "..." + api_key[-4:] if len(api_key) > 8 else "***"
    console.print(f"\n[bold {SUCCESS}]✓[/] Stored [{ORANGE}]{env_var}[/] ({masked}) in [dim]{GLOBAL_ENV_FILE}[/]")
    console.print(f"  [dim]Run [bold {ORANGE}]codey models --test[/] to verify API connectivity.[/]\n")


@auth_app.command("list")
def auth_list() -> None:
    """List configured provider API keys."""
    import os
    from codey.config.loader import load_config
    config = load_config()

    console.print(f"\n[bold {ORANGE}]CONFIGURED API KEYS[/]\n")
    for p_name, p_cfg in config.providers.items():
        key_env = p_cfg.api_key_env
        if not key_env:
            console.print(f"  • [{ORANGE}]{p_name:<10}[/] Local server (no key needed)")
            continue

        val = os.getenv(key_env)
        if val:
            masked = val[:4] + "..." + val[-4:] if len(val) > 8 else "***"
            console.print(f"  • [{ORANGE}]{p_name:<10}[/] [{SUCCESS}]✓ Configured[/] ({key_env}={masked})")
        else:
            console.print(f"  • [{ORANGE}]{p_name:<10}[/] [{ERROR}]✗ Missing[/] (export {key_env}=... or codey auth set {p_name} <key>)")
    console.print()


@app.command()
def models(
    test: bool = typer.Option(False, "--test", "-t", help="Test live API connectivity for all configured models"),
    project_dir: Optional[str] = typer.Option(None, "--project", "-p", help="Project directory"),
) -> None:
    """List configured models, API key configuration status, and verify live connectivity."""
    project_root = Path(project_dir) if project_dir else Path.cwd()
    config = load_config(project_root)
    event_bus = EventBus()
    router = _setup_router(config, event_bus)

    if test:
        console.print(f"\n  [bold {ORANGE}]Testing live connectivity to all configured models...[/]\n")
        import asyncio
        results = asyncio.run(router.test_all_models())
        for r in results:
            status_icon = f"[{SUCCESS}]✓[/]" if r["success"] else f"[{ERROR}]✗[/]"
            console.print(f"    {status_icon} [{ORANGE}]{r['alias']:<20}[/] {r['message']}")
        console.print()
        return

    catalog = router.get_model_catalog()
    console.print(f"\n  [bold {ORANGE}]AVAILABLE PROVIDERS & MODELS[/]\n")

    for entry in catalog:
        p_name = entry["provider"].upper()
        if entry["key_env"]:
            key_status = f"[{SUCCESS}]✓ Key configured ({entry['key_env']})[/]" if entry["has_key"] else f"[{ERROR}]✗ Missing key: export {entry['key_env']}=...[/]"
        else:
            key_status = f"[{SUCCESS}]✓ Local server[/]"

        console.print(f"  [bold]{p_name}[/] [dim]({entry['base_url']})[/]  {key_status}")

        for m in entry["models"]:
            active_badge = f" [bold {ORANGE}]▶ (ACTIVE)[/]" if m["is_active"] else ""
            chain_badge = f"[{DIM}]in chain[/]" if m["in_chain"] else ""
            console.print(f"    • [{ORANGE}]{m['alias']:<20}[/] [dim]{m['model_id']:<32}[/] {chain_badge}{active_badge}")
        console.print()

    chain_str = " → ".join(p.model_alias for p in router.chain)
    console.print(f"  [dim]Failover Chain:[/] [dim]{chain_str}[/dim]")
    console.print(f"  [dim]Tip:[/] Run [bold {ORANGE}]codey models --test[/] to verify API keys and network connectivity.\n")


if __name__ == "__main__":
    app()
