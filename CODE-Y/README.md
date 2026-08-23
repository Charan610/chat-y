# CODE-Y

**Terminal-native, provider-agnostic AI coding agent** with automatic multi-provider failover, MCP support, and an Orange & Black TUI.

## Quickstart

```bash
# Install
pipx install codey-agent

# Set up API key
export NVIDIA_API_KEY=your-key

# Initialize project
codey init

# Start coding
codey chat
```

## Features

- **Multi-provider failover**: NIM → Groq → Gemini → Local (Ollama), automatic switching on errors
- **MCP client support**: Connect any MCP server, tools merge seamlessly
- **Full transparency**: See every tool call before it executes, live context meter, failover banners
- **Plugin system**: Extend with custom tools and slash commands

## Configuration

Global config: `~/.codey/config.yaml`
Project config: `.codey.yaml` (overrides global)

## License

MIT
