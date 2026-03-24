#!/usr/bin/env bash
set -uo pipefail

# Gate 4 — Cross-Layer Contract Tests
# Runs all 8 contract tests and outputs gate4-report.json.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

REPORT_FILE="$PROJECT_DIR/gate4-report.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
RESULTS=()

record_result() {
    local contract="$1"
    local status="$2"
    local detail="$3"

    case "$status" in
        PASS)
            PASS_COUNT=$((PASS_COUNT + 1))
            echo -e "  ${GREEN}✓ PASS${NC}  $contract — $detail"
            ;;
        FAIL)
            FAIL_COUNT=$((FAIL_COUNT + 1))
            echo -e "  ${RED}✗ FAIL${NC}  $contract — $detail"
            ;;
        SKIP)
            SKIP_COUNT=$((SKIP_COUNT + 1))
            echo -e "  ${YELLOW}⊘ SKIP${NC}  $contract — $detail"
            ;;
    esac

    local safe_detail
    safe_detail=$(echo "$detail" | sed 's/"/\\"/g' | head -c 500)
    RESULTS+=("{\"contract\": \"$contract\", \"status\": \"$status\", \"detail\": \"$safe_detail\"}")
}

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║       GATE 4 — CROSS-LAYER CONTRACT TESTS       ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Contracts 1–6: TypeScript (Vitest) ──
echo "── TypeScript Contract Tests (Vitest) ──"
echo ""

# Contracts 1-4, 6 run via Vitest
VITEST_CONTRACTS=(
    "contract-1-postgres:Contract 1: TypeScript → PostgreSQL"
    "contract-2-redis:Contract 2: TypeScript → Redis"
    "contract-3-ollama:Contract 3: TypeScript → Ollama"
    "contract-4-anthropic:Contract 4: TypeScript → Anthropic API"
    "contract-6-audit:Contract 6: TypeScript → Audit Log"
)

for entry in "${VITEST_CONTRACTS[@]}"; do
    file="${entry%%:*}"
    name="${entry##*:}"

    echo -e "  ${CYAN}Running $name...${NC}"
    OUTPUT=$(pnpm --filter @rsf/foundation exec vitest run "tests/${file}.test.ts" --reporter=verbose 2>&1)
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
        PASSED_TESTS=$(echo "$OUTPUT" | grep -cE "✓|✅" || true)
        SKIPPED_TESTS=$(echo "$OUTPUT" | grep -c "skipped" || true)
        if [ "$SKIPPED_TESTS" -gt 0 ] && [ "$PASSED_TESTS" -gt 0 ]; then
            record_result "$name" "PASS" "${PASSED_TESTS} passed, ${SKIPPED_TESTS} skipped"
        else
            record_result "$name" "PASS" "All tests passed"
        fi
    else
        FAIL_INFO=$(echo "$OUTPUT" | grep -A 2 -E "FAIL|Error|AssertionError|expect" | head -6 | tr '\n' ' ')
        record_result "$name" "FAIL" "$FAIL_INFO"
        echo "$OUTPUT" | tail -20
        echo ""
    fi
done

# Contract 5 runs via tsx (Temporal native bindings incompatible with Vite)
echo -e "  ${CYAN}Running Contract 5: TypeScript → Temporal...${NC}"
OUTPUT=$(pnpm --filter @rsf/foundation exec tsx tests/contract-5-temporal.test.ts 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    PASSED_TESTS=$(echo "$OUTPUT" | grep -c "✓ PASS" || true)
    record_result "Contract 5: TypeScript → Temporal" "PASS" "${PASSED_TESTS} passed (via tsx)"
else
    FAIL_INFO=$(echo "$OUTPUT" | grep -E "FAIL|Error" | head -3 | tr '\n' ' ')
    record_result "Contract 5: TypeScript → Temporal" "FAIL" "$FAIL_INFO"
    echo "$OUTPUT" | tail -20
    echo ""
fi

echo ""

# ── Contracts 7–8: Python (pytest) ──
echo "── Python Contract Tests (pytest) ──"
echo ""

PY_VENV="$PROJECT_DIR/packages/quality/python/.venv/bin"

PY_CONTRACTS=(
    "tests/test_contract_7_ollama.py:Contract 7: Python → Ollama"
    "tests/test_contract_8_anthropic.py:Contract 8: Python → Anthropic API"
)

for entry in "${PY_CONTRACTS[@]}"; do
    file="${entry%%:*}"
    name="${entry##*:}"

    echo -e "  ${CYAN}Running $name...${NC}"
    OUTPUT=$("$PY_VENV/python" -m pytest "$PROJECT_DIR/packages/quality/python/$file" -v --tb=short 2>&1)
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
        PASSED=$(echo "$OUTPUT" | grep -oP '\d+ passed' || echo "tests passed")
        SKIPPED=$(echo "$OUTPUT" | grep -oP '\d+ skipped' || true)
        DETAIL="$PASSED"
        if [ -n "$SKIPPED" ]; then
            DETAIL="$PASSED, $SKIPPED"
        fi
        record_result "$name" "PASS" "$DETAIL"
    elif [ $EXIT_CODE -eq 5 ]; then
        # pytest exit code 5 = no tests collected (all skipped)
        record_result "$name" "SKIP" "All tests skipped (likely missing API key)"
    else
        FAIL_INFO=$(echo "$OUTPUT" | grep -E "FAILED|ERROR|assert" | head -3 | tr '\n' ' ')
        record_result "$name" "FAIL" "$FAIL_INFO"
        echo "$OUTPUT" | tail -20
        echo ""
    fi
done

echo ""

# ── Generate JSON report ──
echo "── Report ──"

JSON_RESULTS=$(printf '%s\n' "${RESULTS[@]}" | paste -sd ',' -)

TOTAL=$((PASS_COUNT + FAIL_COUNT + SKIP_COUNT))

cat > "$REPORT_FILE" <<EOJSON
{
  "gate": "Gate 4 — Cross-Layer Contract Tests",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "summary": {
    "total": $TOTAL,
    "passed": $PASS_COUNT,
    "failed": $FAIL_COUNT,
    "skipped": $SKIP_COUNT
  },
  "results": [$JSON_RESULTS]
}
EOJSON

echo "  Report written to: $REPORT_FILE"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  GATE 4 PASSED — $PASS_COUNT passed, $SKIP_COUNT skipped, 0 failed${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    echo -e "${RED}  GATE 4 FAILED — $FAIL_COUNT of $TOTAL contracts failed${NC}"
    echo -e "${RED}  Fix all failures before proceeding to Layer 2${NC}"
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    exit 1
fi
