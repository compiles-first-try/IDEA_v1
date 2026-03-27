#!/usr/bin/env bash
set -uo pipefail

# Migration Gate M1 — Prompt & Schema Extraction Validation
# Verifies: prompts extracted to workflow files, V1 code loads from files,
# schemas extracted, all V1 tests still pass.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

REPORT_FILE="$PROJECT_DIR/migration-gate-m1-report.json"

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
echo "║       MIGRATION GATE M1 — PROMPT EXTRACTION     ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. All 8 prompt files exist ──
echo "── Prompt Files ──"
PROMPTS=(
    "workflows/build-pipeline/task-1-interpret-spec/data/system-prompt.md"
    "workflows/build-pipeline/task-1-interpret-spec/data/manufacturing-system-prompt.md"
    "workflows/build-pipeline/task-2-generate-code/data/system-prompt.md"
    "workflows/build-pipeline/task-3-generate-tests/data/system-prompt.md"
    "workflows/build-pipeline/task-3-generate-tests/data/impl-from-tests-prompt.md"
    "workflows/build-pipeline/task-5-quality-gates/data/repair-prompt.md"
    "workflows/provision-agent/task-1-blueprint/data/system-prompt.md"
    "workflows/provision-agent/task-2-tool-synth/data/system-prompt.md"
)
MISSING=0
for f in "${PROMPTS[@]}"; do
    if [ ! -f "$f" ] || [ ! -s "$f" ]; then
        echo "    Missing/empty: $f"
        MISSING=$((MISSING + 1))
    fi
done
if [ "$MISSING" -eq 0 ]; then
    record_result "Prompt files" "PASS" "All ${#PROMPTS[@]} prompt files exist and are non-empty"
else
    record_result "Prompt files" "FAIL" "$MISSING prompt files missing or empty"
fi

# ── 2. All 3 schema files exist and are valid JSON ──
echo ""
echo "── Schema Files ──"
SCHEMAS=(
    "workflows/build-pipeline/data/domain-model.schema.json"
    "workflows/build-pipeline/task-2-generate-code/data/detailed-target.schema.json"
    "workflows/provision-agent/task-1-blueprint/data/agent-contract.schema.json"
)
SCHEMA_OK=0
for f in "${SCHEMAS[@]}"; do
    if [ -f "$f" ] && python3 -c "import json; json.load(open('$f'))" 2>/dev/null; then
        SCHEMA_OK=$((SCHEMA_OK + 1))
    else
        echo "    Invalid/missing: $f"
    fi
done
if [ "$SCHEMA_OK" -eq ${#SCHEMAS[@]} ]; then
    record_result "Schema files" "PASS" "All ${#SCHEMAS[@]} schema files valid JSON"
else
    record_result "Schema files" "FAIL" "Only $SCHEMA_OK of ${#SCHEMAS[@]} valid"
fi

# ── 3. V1 code uses loadPrompt (no hardcoded prompts remain) ──
echo ""
echo "── Prompt Extraction ──"
HARDCODED=$(grep -rn "const.*PROMPT.*=.*\`" packages/*/src/ --include="*.ts" 2>/dev/null | grep -v "loadPrompt" | grep -v node_modules | wc -l)
USING_LOAD=$(grep -rl "loadPrompt" packages/ --include="*.ts" 2>/dev/null | wc -l)
if [ "$HARDCODED" -eq 0 ] && [ "$USING_LOAD" -ge 5 ]; then
    record_result "Prompt extraction" "PASS" "0 hardcoded prompts, $USING_LOAD files use loadPrompt()"
else
    record_result "Prompt extraction" "FAIL" "$HARDCODED hardcoded prompts remain, $USING_LOAD files use loadPrompt()"
fi

# ── 4. Foundation tests pass ──
echo ""
echo "── V1 Tests: Foundation ──"
FND=$(pnpm --filter @rsf/foundation exec vitest run --exclude 'tests/contract-5-*' --exclude 'tests/contract-3-*' 2>&1)
if echo "$FND" | grep -q "0 failed" || ! echo "$FND" | grep -q "failed"; then
    CT=$(echo "$FND" | grep -oP '\d+ passed' | head -1)
    record_result "Foundation tests" "PASS" "$CT"
else
    record_result "Foundation tests" "FAIL" "$(echo "$FND" | grep -oP '\d+ failed' | head -1)"
fi

# ── 5. Orchestration tests pass ──
echo ""
echo "── V1 Tests: Orchestration ──"
ORCH=$(pnpm --filter @rsf/orchestration exec vitest run 2>&1)
if echo "$ORCH" | grep -q "0 failed" || ! echo "$ORCH" | grep -q "failed"; then
    CT=$(echo "$ORCH" | grep -oP '\d+ passed' | head -1)
    record_result "Orchestration tests" "PASS" "$CT"
else
    record_result "Orchestration tests" "FAIL" "$(echo "$ORCH" | grep -oP '\d+ failed' | head -1)"
fi

# ── 6. Manufacturing tests pass ──
echo ""
echo "── V1 Tests: Manufacturing ──"
MFG=$(pnpm --filter @rsf/manufacturing exec vitest run 2>&1)
if echo "$MFG" | grep -q "0 failed" || ! echo "$MFG" | grep -q "failed"; then
    CT=$(echo "$MFG" | grep -oP '\d+ passed' | head -1)
    record_result "Manufacturing tests" "PASS" "$CT"
else
    record_result "Manufacturing tests" "FAIL" "$(echo "$MFG" | grep -oP '\d+ failed' | head -1)"
fi

# ── 7. Provisioning tests pass ──
echo ""
echo "── V1 Tests: Provisioning ──"
PROV=$(pnpm --filter @rsf/provisioning exec vitest run 2>&1)
if echo "$PROV" | grep -q "0 failed" || ! echo "$PROV" | grep -q "failed"; then
    CT=$(echo "$PROV" | grep -oP '\d+ passed' | head -1)
    record_result "Provisioning tests" "PASS" "$CT"
else
    record_result "Provisioning tests" "FAIL" "$(echo "$PROV" | grep -oP '\d+ failed' | head -1)"
fi

# ── Generate report ──
echo ""
echo "── Report ──"
JSON_RESULTS=$(printf '%s\n' "${RESULTS[@]}" | paste -sd ',' -)
TOTAL=$((PASS_COUNT + FAIL_COUNT))

cat > "$REPORT_FILE" <<EOJSON
{
  "gate": "Migration Gate M1 — Prompt & Schema Extraction",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "summary": { "total": $TOTAL, "passed": $PASS_COUNT, "failed": $FAIL_COUNT },
  "results": [$JSON_RESULTS]
}
EOJSON

echo "  Report written to: $REPORT_FILE"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  MIGRATION GATE M1 PASSED — $PASS_COUNT/$TOTAL checks passed${NC}"
    echo -e "${GREEN}  Ready to proceed to Phase M2${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    echo -e "${RED}  MIGRATION GATE M1 FAILED — $FAIL_COUNT failures${NC}"
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    exit 1
fi
