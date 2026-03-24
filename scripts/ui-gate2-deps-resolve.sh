#!/usr/bin/env bash
set -uo pipefail

# UI Gate 2 — Dependency Resolution
# Verifies Tauri app scaffold, all deps resolved, tsc clean, Vite starts.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

REPORT_FILE="$PROJECT_DIR/ui-gate2-report.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()

record_result() {
    local check="$1"
    local status="$2"
    local detail="$3"

    if [ "$status" = "PASS" ]; then
        PASS_COUNT=$((PASS_COUNT + 1))
        echo -e "  ${GREEN}✓ PASS${NC}  $check — $detail"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo -e "  ${RED}✗ FAIL${NC}  $check — $detail"
    fi

    local safe_detail
    safe_detail=$(echo "$detail" | sed 's/"/\\"/g' | head -c 300)
    RESULTS+=("{\"check\": \"$check\", \"status\": \"$status\", \"detail\": \"$safe_detail\"}")
}

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║       UI GATE 2 — DEPENDENCY RESOLUTION         ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# 1. App scaffold exists
echo "── Scaffold ──"
if [ -f "apps/desktop/package.json" ] && [ -f "apps/desktop/src-tauri/Cargo.toml" ] && [ -f "apps/desktop/src-tauri/tauri.conf.json" ]; then
    record_result "Tauri scaffold" "PASS" "apps/desktop with src-tauri and frontend"
else
    record_result "Tauri scaffold" "FAIL" "Missing scaffold files"
fi

# 2. Workspace includes desktop
if grep -q "apps/desktop" pnpm-workspace.yaml 2>/dev/null; then
    record_result "Workspace config" "PASS" "apps/desktop in pnpm-workspace.yaml"
else
    record_result "Workspace config" "FAIL" "apps/desktop not in workspace"
fi

# 3. pnpm lockfile clean
echo ""
echo "── Dependencies ──"
PNPM_OUTPUT=$(pnpm install 2>&1)
if echo "$PNPM_OUTPUT" | grep -qiE "ERR_PNPM|error|unresolved"; then
    record_result "pnpm install" "FAIL" "Dependency resolution errors"
else
    record_result "pnpm install" "PASS" "All dependencies resolved cleanly"
fi

# 4. No peer dep issues
PEER_ISSUES=$(echo "$PNPM_OUTPUT" | grep -ciE "WARN.*peer|missing peer|unmet peer" || true)
if [ "$PEER_ISSUES" -eq 0 ]; then
    record_result "Peer dependencies" "PASS" "No unmet peer dependency warnings"
else
    record_result "Peer dependencies" "FAIL" "$PEER_ISSUES peer dependency warning(s)"
fi

# 5. TypeScript compiles
echo ""
echo "── TypeScript ──"
TSC_OUTPUT=$(pnpm --filter @rsf/desktop exec tsc --noEmit 2>&1)
if [ $? -eq 0 ]; then
    record_result "TypeScript compilation" "PASS" "tsc --noEmit — zero errors"
else
    ERROR_COUNT=$(echo "$TSC_OUTPUT" | grep -c "error TS" || echo "errors")
    record_result "TypeScript compilation" "FAIL" "$ERROR_COUNT TypeScript errors"
fi

# 6. Vite dev server starts
echo ""
echo "── Vite Dev Server ──"
VITE_OUTPUT=$(timeout 10 pnpm --filter @rsf/desktop exec vite --port 1421 2>&1 || true)
if echo "$VITE_OUTPUT" | grep -q "ready in"; then
    VITE_TIME=$(echo "$VITE_OUTPUT" | grep -oP 'ready in \d+' || echo "ready")
    record_result "Vite dev server" "PASS" "$VITE_TIME ms"
else
    record_result "Vite dev server" "FAIL" "Vite did not start"
fi

# 7. Key deps present
echo ""
echo "── Key Dependencies ──"
for dep in react react-dom @tanstack/react-query zustand recharts xterm @monaco-editor/react lucide-react @tauri-apps/api vite tailwindcss; do
    if ls node_modules/.pnpm/${dep/\//@}* &>/dev/null 2>&1 || pnpm --filter @rsf/desktop ls "$dep" 2>/dev/null | grep -q "$dep"; then
        record_result "dep:$dep" "PASS" "installed"
    else
        record_result "dep:$dep" "FAIL" "not found"
    fi
done

# Generate report
echo ""
echo "── Report ──"

JSON_RESULTS=$(printf '%s\n' "${RESULTS[@]}" | paste -sd ',' -)
TOTAL=$((PASS_COUNT + FAIL_COUNT))

cat > "$REPORT_FILE" <<EOJSON
{
  "gate": "UI Gate 2 — Dependency Resolution",
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
    echo -e "${GREEN}  UI GATE 2 PASSED — $PASS_COUNT/$TOTAL checks passed${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    echo -e "${RED}  UI GATE 2 FAILED — $FAIL_COUNT of $TOTAL checks failed${NC}"
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    exit 1
fi
