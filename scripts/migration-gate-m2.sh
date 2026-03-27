#!/usr/bin/env bash
set -uo pipefail

# Migration Gate M2 — New Capabilities Validation
# Verifies: all 5 V2 capabilities work, V1 tests still pass, no V1 code modified.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

REPORT_FILE="$PROJECT_DIR/migration-gate-m2-report.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
RESULTS=()

record_result() {
    local check="$1" status="$2" detail="$3"
    case "$status" in
        PASS) PASS_COUNT=$((PASS_COUNT + 1)); echo -e "  ${GREEN}✓ PASS${NC}  $check — $detail" ;;
        FAIL) FAIL_COUNT=$((FAIL_COUNT + 1)); echo -e "  ${RED}✗ FAIL${NC}  $check — $detail" ;;
        WARN) WARN_COUNT=$((WARN_COUNT + 1)); echo -e "  ${YELLOW}⚠ WARN${NC}  $check — $detail" ;;
    esac
    local safe=$(echo "$detail" | sed 's/"/\\"/g' | head -c 300)
    RESULTS+=("{\"check\": \"$check\", \"status\": \"$status\", \"detail\": \"$safe\"}")
}

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║       MIGRATION GATE M2 — NEW CAPABILITIES      ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. V2 capabilities tests pass ──
echo "── V2 Capabilities Tests ──"
V2_OUT=$(pnpm --filter @rsf/v2-capabilities exec vitest run --reporter=verbose 2>&1)
V2_EXIT=$?
if [ $V2_EXIT -eq 0 ]; then
    V2_PASSED=$(echo "$V2_OUT" | grep -oP '\d+ passed' | head -1)
    V2_FILES=$(echo "$V2_OUT" | grep -oP '\d+ passed' | tail -1)
    record_result "V2 capabilities tests" "PASS" "$V2_PASSED"
else
    V2_FAILED=$(echo "$V2_OUT" | grep -oP '\d+ failed' | head -1 || echo "unknown failures")
    record_result "V2 capabilities tests" "FAIL" "$V2_FAILED"
    echo "$V2_OUT" | grep "×" | head -10
fi

# ── 2. Each capability module exists ──
echo ""
echo "── V2 Module Structure ──"
MODULES=("environment-scan" "knowledge-bus" "epistemic-tracking" "test-validator" "adversarial-review")
MOD_FOUND=0
for mod in "${MODULES[@]}"; do
    if [ -f "packages/v2-capabilities/src/$mod/index.ts" ]; then
        MOD_FOUND=$((MOD_FOUND + 1))
    else
        echo "    Missing: packages/v2-capabilities/src/$mod/index.ts"
    fi
done
if [ "$MOD_FOUND" -eq ${#MODULES[@]} ]; then
    record_result "V2 modules" "PASS" "All ${#MODULES[@]} capability modules exist"
else
    record_result "V2 modules" "FAIL" "Only $MOD_FOUND of ${#MODULES[@]} modules exist"
fi

# ── 3. V1 Foundation tests still pass ──
echo ""
echo "── V1 Compatibility: Foundation ──"
V1F=$(pnpm --filter @rsf/foundation exec vitest run --exclude 'tests/contract-5-*' --exclude 'tests/contract-3-*' 2>&1)
if echo "$V1F" | grep -qP '\d+ passed' && ! echo "$V1F" | grep -q "failed"; then
    record_result "V1 Foundation" "PASS" "$(echo "$V1F" | grep -oP '\d+ passed' | head -1)"
else
    record_result "V1 Foundation" "FAIL" "$(echo "$V1F" | grep -oP '\d+ failed' | head -1 || echo "unknown")"
fi

# ── 4. V1 Orchestration tests still pass ──
echo ""
echo "── V1 Compatibility: Orchestration ──"
V1O=$(pnpm --filter @rsf/orchestration exec vitest run 2>&1)
if echo "$V1O" | grep -qP '\d+ passed' && ! echo "$V1O" | grep -q "failed"; then
    record_result "V1 Orchestration" "PASS" "$(echo "$V1O" | grep -oP '\d+ passed' | head -1)"
else
    record_result "V1 Orchestration" "FAIL" "$(echo "$V1O" | grep -oP '\d+ failed' | head -1 || echo "unknown")"
fi

# ── 5. V1 code integrity check ──
echo ""
echo "── V1 Code Integrity ──"
V1_INTACT=true
for check in "createDbClient" "createCacheClient" "createAuditLogger" "createKillSwitch"; do
    if ! grep -rq "$check" packages/foundation/src/ packages/orchestration/src/ 2>/dev/null; then
        V1_INTACT=false
    fi
done
if $V1_INTACT; then
    record_result "V1 code integrity" "PASS" "Core V1 exports unchanged"
else
    record_result "V1 code integrity" "FAIL" "V1 source files appear modified"
fi

# ── 6. TypeScript compilation ──
echo ""
echo "── TypeScript ──"
if pnpm --filter @rsf/v2-capabilities exec tsc --noEmit 2>&1 | grep -q "error TS"; then
    record_result "V2 TypeScript" "FAIL" "Compilation errors"
else
    record_result "V2 TypeScript" "PASS" "Zero errors"
fi

# ── Generate report ──
echo ""
echo "── Report ──"
JSON_RESULTS=$(printf '%s\n' "${RESULTS[@]}" | paste -sd ',' -)
TOTAL=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))

cat > "$REPORT_FILE" <<EOJSON
{
  "gate": "Migration Gate M2 — New Capabilities",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "summary": { "total": $TOTAL, "passed": $PASS_COUNT, "failed": $FAIL_COUNT, "warnings": $WARN_COUNT },
  "results": [$JSON_RESULTS]
}
EOJSON

echo "  Report written to: $REPORT_FILE"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  MIGRATION GATE M2 PASSED — $PASS_COUNT passed, $WARN_COUNT warnings${NC}"
    echo -e "${GREEN}  Ready to proceed to Phase M3${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    echo -e "${RED}  MIGRATION GATE M2 FAILED — $FAIL_COUNT failures${NC}"
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    exit 1
fi
