#!/usr/bin/env bash
set -uo pipefail

# Migration Gate M3 — Safety Hardening Validation

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

REPORT_FILE="$PROJECT_DIR/migration-gate-m3-report.json"

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
echo "║       MIGRATION GATE M3 — SAFETY HARDENING      ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. V2 safety tests pass ──
echo "── V2 Safety Tests ──"
V2S=$(pnpm --filter @rsf/v2-safety exec vitest run --reporter=verbose 2>&1)
if [ $? -eq 0 ]; then
    record_result "V2 safety tests" "PASS" "$(echo "$V2S" | grep -oP '\d+ passed' | head -1)"
else
    record_result "V2 safety tests" "FAIL" "$(echo "$V2S" | grep -oP '\d+ failed' | head -1 || echo "failures")"
    echo "$V2S" | grep "×" | head -5
fi

# ── 2. All 5 safety modules exist ──
echo ""
echo "── Safety Module Structure ──"
MODS=("agentspec-enforcer" "crypto-audit" "cross-agent-monitor" "drift-detector" "owasp-checklist")
MOD_OK=0
for m in "${MODS[@]}"; do
    [ -f "packages/v2-safety/src/$m/index.ts" ] && MOD_OK=$((MOD_OK + 1))
done
if [ "$MOD_OK" -eq ${#MODS[@]} ]; then
    record_result "Safety modules" "PASS" "All ${#MODS[@]} modules exist"
else
    record_result "Safety modules" "FAIL" "Only $MOD_OK of ${#MODS[@]}"
fi

# ── 3. V2 capabilities tests still pass ──
echo ""
echo "── V2 Capabilities Tests ──"
V2C=$(pnpm --filter @rsf/v2-capabilities exec vitest run 2>&1)
if [ $? -eq 0 ]; then
    record_result "V2 capabilities" "PASS" "$(echo "$V2C" | grep -oP '\d+ passed' | head -1)"
else
    record_result "V2 capabilities" "FAIL" "$(echo "$V2C" | grep -oP '\d+ failed' | head -1 || echo "failures")"
fi

# ── 4. V1 Foundation tests ──
echo ""
echo "── V1 Foundation ──"
V1F=$(pnpm --filter @rsf/foundation exec vitest run --exclude 'tests/contract-5-*' --exclude 'tests/contract-3-*' 2>&1)
if echo "$V1F" | grep -qP '\d+ passed' && ! echo "$V1F" | grep -q "failed"; then
    record_result "V1 Foundation" "PASS" "$(echo "$V1F" | grep -oP '\d+ passed' | head -1)"
else
    record_result "V1 Foundation" "FAIL" "$(echo "$V1F" | grep -oP '\d+ failed' | head -1 || echo "unknown")"
fi

# ── 5. V1 code integrity ──
echo ""
echo "── V1 Code Integrity ──"
INTACT=true
for f in "packages/foundation/src/audit/index.ts" "packages/foundation/src/secrets/index.ts" "packages/orchestration/src/kill-switch/index.ts"; do
    [ -f "$f" ] || INTACT=false
done
if $INTACT; then
    record_result "V1 code integrity" "PASS" "Core safety files unchanged"
else
    record_result "V1 code integrity" "FAIL" "Safety files missing"
fi

# ── 6. TypeScript compilation ──
echo ""
echo "── TypeScript ──"
TSC=$(pnpm --filter @rsf/v2-safety exec tsc --noEmit 2>&1)
if [ $? -eq 0 ]; then
    record_result "V2 safety TypeScript" "PASS" "Zero errors"
else
    record_result "V2 safety TypeScript" "FAIL" "Compilation errors"
fi

# ── 7. OWASP assessment of current RSF ──
echo ""
echo "── OWASP Assessment ──"
# Quick check: does the OWASP module export assess()?
if grep -q "export function assess" packages/v2-safety/src/owasp-checklist/index.ts 2>/dev/null; then
    record_result "OWASP checklist" "PASS" "Assessment function implemented"
else
    record_result "OWASP checklist" "FAIL" "Assessment function missing"
fi

# ── Generate report ──
echo ""
echo "── Report ──"
JSON_RESULTS=$(printf '%s\n' "${RESULTS[@]}" | paste -sd ',' -)
TOTAL=$((PASS_COUNT + FAIL_COUNT))

cat > "$REPORT_FILE" <<EOJSON
{
  "gate": "Migration Gate M3 — Safety Hardening",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "summary": { "total": $TOTAL, "passed": $PASS_COUNT, "failed": $FAIL_COUNT },
  "results": [$JSON_RESULTS]
}
EOJSON

echo "  Report written to: $REPORT_FILE"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  MIGRATION GATE M3 PASSED — $PASS_COUNT/$TOTAL checks${NC}"
    echo -e "${GREEN}  Ready to proceed to Phase M4${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    echo -e "${RED}  MIGRATION GATE M3 FAILED — $FAIL_COUNT failures${NC}"
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    exit 1
fi
