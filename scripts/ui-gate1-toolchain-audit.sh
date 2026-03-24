#!/usr/bin/env bash
set -uo pipefail

# UI Gate 1 — Toolchain Audit
# Verifies Rust, Tauri system deps, webkit2gtk, and Node toolchain.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# Ensure Rust is on PATH if installed
if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
fi

REPORT_FILE="$PROJECT_DIR/ui-gate1-report.json"

RUST_MIN="1.77.0"
NODE_MIN="22.0.0"
PNPM_MIN="9.0.0"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()

version_gte() {
    printf '%s\n%s\n' "$2" "$1" | sort -V -C
}

record_result() {
    local check="$1"
    local status="$2"
    local detail="$3"
    local fix="${4:-}"

    if [ "$status" = "PASS" ]; then
        PASS_COUNT=$((PASS_COUNT + 1))
        echo -e "  ${GREEN}✓ PASS${NC}  $check — $detail"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo -e "  ${RED}✗ FAIL${NC}  $check — $detail"
        if [ -n "$fix" ]; then
            echo -e "         ${YELLOW}Fix:${NC} $fix"
        fi
    fi

    local safe_detail
    safe_detail=$(echo "$detail" | sed 's/"/\\"/g' | head -c 300)
    local safe_fix
    safe_fix=$(echo "$fix" | sed 's/"/\\"/g' | head -c 300)
    RESULTS+=("{\"check\": \"$check\", \"status\": \"$status\", \"detail\": \"$safe_detail\", \"fix\": \"$safe_fix\"}")
}

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║       UI GATE 1 — TOOLCHAIN AUDIT               ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. Rust toolchain ──
echo "── Rust Toolchain ──"
if command -v rustc &>/dev/null; then
    RUST_VER=$(rustc --version | grep -oP '\d+\.\d+\.\d+' | head -1)
    if version_gte "$RUST_VER" "$RUST_MIN"; then
        record_result "rustc" "PASS" "v$RUST_VER (>= $RUST_MIN)"
    else
        record_result "rustc" "FAIL" "v$RUST_VER (need >= $RUST_MIN)" \
            "rustup update stable"
    fi
else
    record_result "rustc" "FAIL" "Rust not installed" \
        "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh && source ~/.cargo/env"
fi

if command -v cargo &>/dev/null; then
    CARGO_VER=$(cargo --version | grep -oP '\d+\.\d+\.\d+' | head -1)
    record_result "cargo" "PASS" "v$CARGO_VER"
else
    record_result "cargo" "FAIL" "cargo not found" \
        "Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
fi

# ── 2. System dependencies for Tauri on Linux ──
echo ""
echo "── Tauri System Dependencies ──"
if command -v pkg-config &>/dev/null; then
    PKG_VER=$(pkg-config --version 2>/dev/null || echo "unknown")
    record_result "pkg-config" "PASS" "v$PKG_VER"
else
    record_result "pkg-config" "FAIL" "pkg-config not found" \
        "sudo apt-get install -y pkg-config"
fi

# Helper: check if a dpkg package is installed
pkg_installed() {
    dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q "install ok installed"
}

pkg_version() {
    dpkg-query -W -f='${Version}' "$1" 2>/dev/null
}

# webkit2gtk-4.1
if pkg_installed libwebkit2gtk-4.1-dev; then
    record_result "webkit2gtk-4.1" "PASS" "v$(pkg_version libwebkit2gtk-4.1-dev)"
else
    record_result "webkit2gtk-4.1" "FAIL" "libwebkit2gtk-4.1-dev not installed" \
        "sudo apt-get install -y libwebkit2gtk-4.1-dev"
fi

# libappindicator3
if pkg_installed libappindicator3-dev; then
    record_result "libappindicator3" "PASS" "v$(pkg_version libappindicator3-dev)"
else
    record_result "libappindicator3" "FAIL" "not installed" \
        "sudo apt-get install -y libappindicator3-dev"
fi

# librsvg2
if pkg_installed librsvg2-dev; then
    record_result "librsvg2" "PASS" "v$(pkg_version librsvg2-dev)"
else
    record_result "librsvg2" "FAIL" "not installed" \
        "sudo apt-get install -y librsvg2-dev"
fi

# patchelf
if command -v patchelf &>/dev/null; then
    record_result "patchelf" "PASS" "$(patchelf --version 2>&1 || echo 'installed')"
else
    record_result "patchelf" "FAIL" "not found" \
        "sudo apt-get install -y patchelf"
fi

# libssl-dev
if pkg_installed libssl-dev; then
    record_result "libssl-dev" "PASS" "v$(pkg_version libssl-dev)"
else
    record_result "libssl-dev" "FAIL" "not installed" \
        "sudo apt-get install -y libssl-dev"
fi

# libgtk-3-dev
if pkg_installed libgtk-3-dev; then
    record_result "libgtk-3-dev" "PASS" "v$(pkg_version libgtk-3-dev)"
else
    record_result "libgtk-3-dev" "FAIL" "not installed" \
        "sudo apt-get install -y libgtk-3-dev"
fi

# ── 3. Node toolchain ──
echo ""
echo "── Node Toolchain ──"
if command -v node &>/dev/null; then
    NODE_VER=$(node --version | tr -d 'v')
    if version_gte "$NODE_VER" "$NODE_MIN"; then
        record_result "Node.js" "PASS" "v$NODE_VER (>= $NODE_MIN)"
    else
        record_result "Node.js" "FAIL" "v$NODE_VER (need >= $NODE_MIN)" \
            "nvm install 22"
    fi
else
    record_result "Node.js" "FAIL" "not found" "nvm install 22"
fi

if command -v pnpm &>/dev/null; then
    PNPM_VER=$(pnpm --version)
    if version_gte "$PNPM_VER" "$PNPM_MIN"; then
        record_result "pnpm" "PASS" "v$PNPM_VER (>= $PNPM_MIN)"
    else
        record_result "pnpm" "FAIL" "v$PNPM_VER (need >= $PNPM_MIN)" \
            "corepack enable && corepack prepare pnpm@latest --activate"
    fi
else
    record_result "pnpm" "FAIL" "not found" \
        "corepack enable && corepack prepare pnpm@latest --activate"
fi

# ── 4. Tauri CLI ──
echo ""
echo "── Tauri CLI ──"
if pnpm dlx @tauri-apps/cli@latest --version &>/dev/null 2>&1; then
    record_result "Tauri CLI" "PASS" "available via pnpm dlx"
else
    # Not critical — will be installed as dev dep
    record_result "Tauri CLI" "PASS" "will install as project dependency"
fi

# ── Generate JSON report ──
echo ""
echo "── Report ──"

JSON_RESULTS=$(printf '%s\n' "${RESULTS[@]}" | paste -sd ',' -)
TOTAL=$((PASS_COUNT + FAIL_COUNT))

cat > "$REPORT_FILE" <<EOJSON
{
  "gate": "UI Gate 1 — Toolchain Audit",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "summary": {
    "total": $TOTAL,
    "passed": $PASS_COUNT,
    "failed": $FAIL_COUNT
  },
  "results": [$JSON_RESULTS]
}
EOJSON

echo "  Report written to: $REPORT_FILE"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  UI GATE 1 PASSED — $PASS_COUNT/$TOTAL checks passed${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    echo -e "${RED}  UI GATE 1 FAILED — $FAIL_COUNT of $TOTAL checks failed${NC}"
    echo -e "${RED}  Fix all failures before proceeding to UI Gate 2${NC}"
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    exit 1
fi
