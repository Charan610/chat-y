#!/usr/bin/env bash
# CODE-Y (FORGE) Universal Installer
# Automatically handles macOS (Homebrew/PEP 668), Debian/Ubuntu, and standard Linux.

set -e

# ANSI Color codes
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

# ── 1. Check Python version (Python 3.11+ required) ──
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

# ── 2. Ensure pipx is installed (Platform-Aware, PEP 668 compliant) ──
if command -v pipx &>/dev/null; then
    echo -e "${GREEN}✓ Found existing pipx installation${NC}"
else
    echo -e "pipx not found. Installing pipx..."
    
    if [ "$(uname)" = "Darwin" ] && command -v brew &>/dev/null; then
        echo -e "${DIM}Installing pipx via Homebrew (macOS)...${NC}"
        brew install pipx
        "$(brew --prefix)/bin/pipx" ensurepath 2>/dev/null || true
    elif command -v apt &>/dev/null; then
        echo -e "${DIM}Installing pipx via apt (Debian/Ubuntu)...${NC}"
        sudo apt update && sudo apt install -y pipx
        pipx ensurepath 2>/dev/null || true
    else
        echo -e "${DIM}Installing pipx via pip...${NC}"
        PIP_ERR=$(python3 -m pip install --user pipx 2>&1) || {
            if echo "$PIP_ERR" | grep -q "externally-managed-environment"; then
                echo -e "${DIM}PEP 668 detected, retrying with --break-system-packages...${NC}"
                python3 -m pip install --user --break-system-packages pipx || {
                    echo -e "${RED}Failed to install pipx:${NC}\n$PIP_ERR"
                    exit 1
                }
            else
                echo -e "${RED}Failed to install pipx:${NC}\n$PIP_ERR"
                exit 1
            fi
        }
        python3 -m pipx ensurepath 2>/dev/null || true
    fi
fi

# ── 3. Configure PATH in the current session ──
export PATH="$HOME/.local/bin:$PATH"

if [ "$(uname)" = "Darwin" ] && command -v brew &>/dev/null; then
    export PATH="$(brew --prefix)/bin:$PATH"
fi

if ! command -v pipx &>/dev/null; then
    echo -e "${RED}Error: pipx was installed but could not be located in PATH in this session.${NC}"
    echo -e "Please open a new terminal window or run ${BOLD}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC} and re-run the installer."
    exit 1
fi

echo -e "${GREEN}✓ pipx is ready${NC}"

# ── 4. Install CODE-Y via pipx from git ──
echo -e "Installing CODE-Y (FORGE) from ${REPO_URL} (subdirectory: ${SUBDIR})..."
pipx install "git+${REPO_URL}#subdirectory=${SUBDIR}" --force

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
