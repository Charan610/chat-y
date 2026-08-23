#!/usr/bin/env bash
# CODE-Y (FORGE) One-Line Installer
# Installs CODE-Y / FORGE terminal AI coding agent using pipx

set -e

# ANSI Color codes (Phosphor Amber / Orange & Black identity)
ORANGE='\033[38;5;208m'
GREEN='\033[0;32m'
RED='\033[0;31m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m' # No Color

REPO_URL="https://github.com/charan610/chat-y.git"
SUBDIR="CODE-Y"

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

# 2. Check for pipx, install if missing
if ! command -v pipx &>/dev/null; then
    echo -e "pipx not found. Installing pipx..."
    python3 -m pip install --user pipx || {
        echo -e "${RED}Failed to install pipx.${NC}"
        exit 1
    }
    python3 -m pipx ensurepath
    export PATH="$PATH:$HOME/.local/bin"
fi
echo -e "${GREEN}✓ pipx is ready${NC}"

# 3. Install CODE-Y via pipx
echo -e "Installing CODE-Y (FORGE) from ${REPO_URL}..."
if [ -n "$SUBDIR" ]; then
    pipx install --force "git+${REPO_URL}#subdirectory=${SUBDIR}" || pipx install --force "git+${REPO_URL}" || {
        echo -e "${RED}Failed to install from git repository.${NC}"
        exit 1
    }
else
    pipx install --force "git+${REPO_URL}" || {
        echo -e "${RED}Failed to install from git repository.${NC}"
        exit 1
    }
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
