#!/usr/bin/env bash
set -uo pipefail

# UI Gate 5 — Phase Completion Validation

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

REPORT_FILE="$PROJECT_DIR/ui-gate5-report.json"
PHASE="${1:-UI_PHASE_1}"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()

record_result() {
    local check="$1" status="$2" detail="$3"
    if [ "$status" = "PASS" ]; then PASS_COUNT=$((PASS_COUNT + 1)); echo -e "  ${GREEN}✓ PASS${NC}  $check — $detail"
    else FAIL_COUNT=$((FAIL_COUNT + 1)); echo -e "  ${RED}✗ FAIL${NC}  $check — $detail"; fi
    local safe=$(echo "$detail" | sed 's/"/\\"/g' | head -c 300)
    RESULTS+=("{\"check\": \"$check\", \"status\": \"$status\", \"detail\": \"$safe\"}")
}

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║       UI GATE 5 — PHASE VALIDATION              ║"
echo "║       Phase: $PHASE"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# 1. All Vitest tests pass
echo "── Vitest Tests ──"
VT=$(pnpm --filter @rsf/desktop exec vitest run --reporter=verbose 2>&1)
if [ $? -eq 0 ]; then
    CT=$(echo "$VT" | grep -oP '\d+ passed' | head -1)
    record_result "Vitest" "PASS" "$CT"
else
    record_result "Vitest" "FAIL" "$(echo "$VT" | grep -oP '\d+ failed' | head -1)"
fi

# 2. TypeScript compiles
echo ""
echo "── TypeScript ──"
if pnpm --filter @rsf/desktop exec tsc --noEmit 2>&1 | grep -q "error TS"; then
    record_result "TypeScript" "FAIL" "Compilation errors"
else
    record_result "TypeScript" "PASS" "Zero errors"
fi

# 3. No hardcoded API URLs
echo ""
echo "── Hardcoded URLs ──"
HARDCODED=$(grep -rn --include="*.tsx" --include="*.ts" \
    "http://localhost:3000\|ws://localhost:3000" \
    apps/desktop/src/ 2>/dev/null | grep -v "client.ts\|api/client" | wc -l)
if [ "$HARDCODED" -eq 0 ]; then
    record_result "No hardcoded API URLs" "PASS" "All URLs from config"
else
    record_result "No hardcoded API URLs" "FAIL" "$HARDCODED hardcoded URL(s) in src/"
fi

# 4. No hardcoded colors (outside globals.css and tailwind theme)
echo ""
echo "── Hardcoded Colors ──"
# Check for raw hex colors in components (allow css vars and tailwind classes)
HC=$(grep -rn --include="*.tsx" \
    '#[0-9a-fA-F]\{6\}' \
    apps/desktop/src/components/ 2>/dev/null | wc -l)
if [ "$HC" -le 2 ]; then
    record_result "No hardcoded colors" "PASS" "$HC raw hex values (within threshold)"
else
    record_result "No hardcoded colors" "FAIL" "$HC raw hex values in components"
fi

# 5. Kill switch visible
echo ""
echo "── Kill Switch ──"
if grep -rq "KillSwitch" apps/desktop/src/components/layout/TopBar.tsx 2>/dev/null; then
    record_result "Kill switch in TopBar" "PASS" "KillSwitch rendered in TopBar"
else
    record_result "Kill switch in TopBar" "FAIL" "KillSwitch not found in TopBar"
fi

# 6. Vite builds
echo ""
echo "── Vite Build ──"
VITE_BUILD=$(pnpm --filter @rsf/desktop exec vite build 2>&1)
if [ $? -eq 0 ]; then
    SIZE=$(echo "$VITE_BUILD" | grep -oP 'dist/.*?kB' | head -3 | tr '\n' ', ')
    record_result "Vite build" "PASS" "Built successfully ($SIZE)"
else
    record_result "Vite build" "FAIL" "Build failed"
fi

# Report
echo ""
echo "── Report ──"
JSON_RESULTS=$(printf '%s\n' "${RESULTS[@]}" | paste -sd ',' -)
TOTAL=$((PASS_COUNT + FAIL_COUNT))

cat > "$REPORT_FILE" <<EOJSON
{
  "gate": "UI Gate 5 — Phase Validation",
  "phase": "$PHASE",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "summary": { "total": $TOTAL, "passed": $PASS_COUNT, "failed": $FAIL_COUNT },
  "results": [$JSON_RESULTS]
}
EOJSON

echo "  Report written to: $REPORT_FILE"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  UI GATE 5 PASSED — $PHASE complete ($PASS_COUNT/$TOTAL)${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    echo -e "${RED}  UI GATE 5 FAILED — $FAIL_COUNT of $TOTAL checks failed${NC}"
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    exit 1
fi
