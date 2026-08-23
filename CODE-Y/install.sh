#!/usr/bin/env bash
# CODE-Y (FORGE) Universal Installer
# Works on macOS (Homebrew/PEP 668 compliant) & Linux with zero errors.

set -e

# ANSI Color codes
ORANGE='\033[38;5;208m'
GREEN='\033[0;32m'
RED='\033[0;31m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m' # No Color

REPO_URL="https://github.com/charan610/chat-y.git"
INSTALL_DIR="$HOME/.local/share/codey"
VENV_DIR="$INSTALL_DIR/venv"
BIN_DIR="$HOME/.local/bin"

echo -e "\n${BOLD}${ORANGE}⚡ CODE-Y (FORGE) Installer${NC}"
echo -e "${DIM}Terminal-native, provider-agnostic AI coding agent${NC}\n"

# 1. Check for Python 3.11+
echo -e "Checking Python version..."
if ! command -v python3 &>/dev/null; then
    echo -e "${RED}Error: Python 3 is not installed.${NC} Please install Python 3.11 or higher."
    exit 1
fi

PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)

if [ "$PY_MAJOR" -lt 3 ] || ([ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 11 ]); then
    echo -e "${RED}Error: Python 3.11+ is required, but found Python $PY_VER.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Found Python $PY_VER${NC}"

# 2. Setup clean isolated environment (PEP 668 compliant)
echo -e "Setting up isolated environment in ${DIM}${INSTALL_DIR}${NC}..."
mkdir -p "$INSTALL_DIR" "$BIN_DIR"

if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
fi

# Upgrade pip inside the venv (completely isolated, no system conflicts)
"$VENV_DIR/bin/python" -m pip install --upgrade pip -q

# 3. Install CODE-Y inside the isolated venv
echo -e "Installing CODE-Y (FORGE) from ${REPO_URL}..."
"$VENV_DIR/bin/pip" install --force-reinstall -q "git+${REPO_URL}#subdirectory=CODE-Y" || \
"$VENV_DIR/bin/pip" install --force-reinstall -q "git+${REPO_URL}" || {
    echo -e "${RED}Failed to install from git repository.${NC}"
    exit 1
}

# 4. Link binaries to ~/.local/bin
ln -sf "$VENV_DIR/bin/codey" "$BIN_DIR/codey"
ln -sf "$VENV_DIR/bin/forge" "$BIN_DIR/forge"
chmod +x "$BIN_DIR/codey" "$BIN_DIR/forge" 2>/dev/null || true

echo -e "${GREEN}✓ Binaries linked to ${BIN_DIR}${NC}"

# 5. Ensure PATH includes ~/.local/bin
CURRENT_SHELL=$(basename "$SHELL")
SHELL_RC=""
if [ "$CURRENT_SHELL" = "zsh" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ "$CURRENT_SHELL" = "bash" ]; then
    if [ -f "$HOME/.bash_profile" ]; then
        SHELL_RC="$HOME/.bash_profile"
    else
        SHELL_RC="$HOME/.bashrc"
    fi
fi

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    export PATH="$BIN_DIR:$PATH"
    if [ -n "$SHELL_RC" ] && [ -f "$SHELL_RC" ]; then
        if ! grep -q 'export PATH="$HOME/.local/bin:$PATH"' "$SHELL_RC"; then
            echo -e '\n# Added by CODE-Y installer\nexport PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_RC"
            echo -e "${DIM}Added ~/.local/bin to PATH in ${SHELL_RC}${NC}"
        fi
    fi
fi

echo -e "\n${GREEN}${BOLD}✓ CODE-Y (FORGE) installed successfully!${NC}\n"
echo -e "${BOLD}Next steps:${NC}"
echo -e "  1. Initialize your project:"
echo -e "     ${ORANGE}codey init${NC}   ${DIM}(or forge init)${NC}"
echo -e "  2. Set your provider API keys:"
echo -e "     ${DIM}export NVIDIA_API_KEY=your-key${NC}"
echo -e "     ${DIM}export GROQ_API_KEY=your-key${NC}"
echo -e "     ${DIM}export GEMINI_API_KEY=your-key${NC}"
echo -e "  3. Start coding:"
echo -e "     ${ORANGE}codey chat${NC}   ${DIM}(or codey chat --tui)${NC}\n"
