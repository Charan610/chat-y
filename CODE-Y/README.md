# CODE-Y (FORGE)

**Terminal-native, provider-agnostic AI coding agent** with automatic multi-provider failover, MCP support, and an Orange & Black (Phosphor Amber) TUI.

## Installation

### One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/charan610/chat-y/main/CODE-Y/install.sh | bash
```

> **Note for macOS users**: The installer uses Homebrew (`brew install pipx`) for the cleanest PEP 668-compliant install. If Homebrew is not installed, it automatically falls back to pip with `--break-system-packages`.

### Quickstart

```bash
# Set up your provider API keys
export NVIDIA_API_KEY=your-key
export GROQ_API_KEY=your-key
export GEMINI_API_KEY=your-key

# Initialize your project configuration
codey init   # or: forge init

# Launch the interactive agent
codey chat   # or: forge chat
# Or launch the full Textual TUI:
codey chat --tui
```

## Features

- **Multi-provider automatic failover**: NVIDIA NIM → Groq → Gemini → Local (Ollama/LM Studio) without losing context mid-task.
- **MCP client support**: Connect any MCP server via `~/.codey/mcp_config.yaml` (Claude Desktop format) — tools merge automatically into the agent registry.
- **Full execution transparency**: Live reasoning stream, tool call display *before* execution, context usage bar (color-shifting), and instant failover notification banners.
- **Plugin system**: Drop Python modules in `~/.codey/plugins/` to add custom tools and slash commands.
- **Unified CLI entrypoints**: Both `codey` and `forge` commands are provided out of the box.

## CLI Commands

| Command | Description |
|---|---|
| `codey chat` / `forge chat` | Launch interactive REPL |
| `codey chat --tui` | Launch full Textual TUI |
| `codey run "<task>"` | One-shot non-interactive task execution |
| `codey init` | Scaffold project `.codey.yaml` and global `~/.codey/config.yaml` |
| `codey plugin install <src>` | Install plugin from path or git URL |
| `codey mcp add <name> <cmd>` | Add an MCP server to configuration |
| `/model <name>` (in-REPL) | Force provider override for current session |
| `/verbose` (in-REPL) | Toggle raw reasoning stream |
| `/context` (in-REPL) | Display token and context window breakdown |
| `/tools` (in-REPL) | List all registered tools |

## License

MIT
