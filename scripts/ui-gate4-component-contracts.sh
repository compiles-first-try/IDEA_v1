#!/usr/bin/env bash
set -uo pipefail

# UI Gate 4 — Component Contract Tests

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

REPORT_FILE="$PROJECT_DIR/ui-gate4-report.json"

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
echo "║       UI GATE 4 — COMPONENT CONTRACT TESTS      ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

CONTRACTS=(
    "KillSwitch:tests/components/KillSwitch.test.tsx"
    "StatusPanel:tests/components/StatusPanel.test.tsx"
    "SpecInput:tests/components/SpecInput.test.tsx"
    "AuditStream:tests/components/AuditStream.test.tsx"
    "ThemeToggle:tests/components/ThemeToggle.test.tsx"
    "ConfigPanel:tests/components/ConfigPanel.test.tsx"
)

for entry in "${CONTRACTS[@]}"; do
    name="${entry%%:*}"
    file="${entry##*:}"

    OUTPUT=$(pnpm --filter @rsf/desktop exec vitest run "$file" --reporter=verbose 2>&1)
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
        TEST_COUNT=$(echo "$OUTPUT" | grep -c "✓" || true)
        record_result "Contract: $name" "PASS" "$TEST_COUNT tests passed"
    else
        FAIL_INFO=$(echo "$OUTPUT" | grep -E "FAIL|×" | head -3 | tr '\n' ' ')
        record_result "Contract: $name" "FAIL" "$FAIL_INFO"
    fi
done

# Also verify tsc clean
echo ""
TSC_OUT=$(pnpm --filter @rsf/desktop exec tsc --noEmit 2>&1)
if [ $? -eq 0 ]; then
    record_result "TypeScript compilation" "PASS" "Zero errors"
else
    record_result "TypeScript compilation" "FAIL" "$(echo "$TSC_OUT" | grep -c 'error TS') errors"
fi

echo ""
echo "── Report ──"

JSON_RESULTS=$(printf '%s\n' "${RESULTS[@]}" | paste -sd ',' -)
TOTAL=$((PASS_COUNT + FAIL_COUNT))

cat > "$REPORT_FILE" <<EOJSON
{
  "gate": "UI Gate 4 — Component Contract Tests",
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
    echo -e "${GREEN}  UI GATE 4 PASSED — $PASS_COUNT/$TOTAL contracts passed${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    echo -e "${RED}  UI GATE 4 FAILED — $FAIL_COUNT of $TOTAL contracts failed${NC}"
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    exit 1
fi
