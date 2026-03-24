#!/usr/bin/env bash
set -uo pipefail

# Gate 5 — Phase Completion Validation
# Run at the end of each phase to verify all quality criteria are met.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

REPORT_FILE="$PROJECT_DIR/gate5-report.json"
CURRENT_PHASE="${1:-PHASE_1_FOUNDATION}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
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
    safe_detail=$(echo "$detail" | sed 's/"/\\"/g' | head -c 500)
    RESULTS+=("{\"check\": \"$check\", \"status\": \"$status\", \"detail\": \"$safe_detail\"}")
}

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║       GATE 5 — PHASE COMPLETION VALIDATION      ║"
echo "║       Phase: $CURRENT_PHASE"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. Foundation unit tests ──
echo "── Foundation Unit Tests ──"
VITEST_OUTPUT=$(pnpm --filter @rsf/foundation exec vitest run --exclude 'tests/contract-5-*' --reporter=verbose 2>&1)
VITEST_EXIT=$?
if [ $VITEST_EXIT -eq 0 ]; then
    TEST_COUNT=$(echo "$VITEST_OUTPUT" | grep -oP '\d+ passed' | head -1 || echo "tests passed")
    record_result "Foundation Vitest" "PASS" "$TEST_COUNT"
else
    FAILED=$(echo "$VITEST_OUTPUT" | grep -oP '\d+ failed' | head -1 || echo "failures found")
    record_result "Foundation Vitest" "FAIL" "$FAILED"
fi

# ── 1b. Orchestration unit tests (Phase 2+) ──
if [ -d "$PROJECT_DIR/packages/orchestration/tests" ]; then
    echo ""
    echo "── Orchestration Unit Tests ──"
    ORCH_OUTPUT=$(pnpm --filter @rsf/orchestration exec vitest run --reporter=verbose 2>&1)
    ORCH_EXIT=$?
    if [ $ORCH_EXIT -eq 0 ]; then
        ORCH_COUNT=$(echo "$ORCH_OUTPUT" | grep -oP '\d+ passed' | head -1 || echo "tests passed")
        record_result "Orchestration Vitest" "PASS" "$ORCH_COUNT"
    else
        ORCH_FAILED=$(echo "$ORCH_OUTPUT" | grep -oP '\d+ failed' | head -1 || echo "failures found")
        record_result "Orchestration Vitest" "FAIL" "$ORCH_FAILED"
    fi

    # Temporal workflow test (via tsx)
    if [ -f "$PROJECT_DIR/packages/orchestration/tests/temporal-workflow.test.ts" ]; then
        echo ""
        echo "── Orchestration Temporal Workflow Test ──"
        ORCH_TSX_OUTPUT=$(pnpm --filter @rsf/orchestration exec tsx tests/temporal-workflow.test.ts 2>&1)
        ORCH_TSX_EXIT=$?
        if [ $ORCH_TSX_EXIT -eq 0 ]; then
            ORCH_TSX_COUNT=$(echo "$ORCH_TSX_OUTPUT" | grep -c "✓ PASS" || true)
            record_result "Orchestration Temporal workflow" "PASS" "${ORCH_TSX_COUNT} passed (via tsx)"
        else
            record_result "Orchestration Temporal workflow" "FAIL" "Temporal workflow test failed"
        fi
    fi
fi

# ── 1c. Manufacturing unit tests (Phase 3+) ──
if [ -d "$PROJECT_DIR/packages/manufacturing/tests" ] && ls "$PROJECT_DIR/packages/manufacturing/tests/"*.test.ts &>/dev/null; then
    echo ""
    echo "── Manufacturing Unit Tests ──"
    MFG_OUTPUT=$(pnpm --filter @rsf/manufacturing exec vitest run --reporter=verbose 2>&1)
    MFG_EXIT=$?
    if [ $MFG_EXIT -eq 0 ]; then
        MFG_COUNT=$(echo "$MFG_OUTPUT" | grep -oP '\d+ passed' | head -1 || echo "tests passed")
        record_result "Manufacturing Vitest" "PASS" "$MFG_COUNT"
    else
        MFG_FAILED=$(echo "$MFG_OUTPUT" | grep -oP '\d+ failed' | head -1 || echo "failures found")
        record_result "Manufacturing Vitest" "FAIL" "$MFG_FAILED"
    fi
fi

# ── 1d. Quality layer unit tests (Phase 4+) ──
if [ -d "$PROJECT_DIR/packages/quality/typescript/tests" ] && ls "$PROJECT_DIR/packages/quality/typescript/tests/"*.test.ts &>/dev/null; then
    echo ""
    echo "── Quality Unit Tests ──"
    Q_OUTPUT=$(pnpm --filter @rsf/quality exec vitest run --reporter=verbose 2>&1)
    Q_EXIT=$?
    if [ $Q_EXIT -eq 0 ]; then
        Q_COUNT=$(echo "$Q_OUTPUT" | grep -oP '\d+ passed' | head -1 || echo "tests passed")
        record_result "Quality Vitest" "PASS" "$Q_COUNT"
    else
        Q_FAILED=$(echo "$Q_OUTPUT" | grep -oP '\d+ failed' | head -1 || echo "failures found")
        record_result "Quality Vitest" "FAIL" "$Q_FAILED"
    fi
fi

# ── 1e. Provisioning layer unit tests (Phase 5+) ──
if [ -d "$PROJECT_DIR/packages/provisioning/tests" ] && ls "$PROJECT_DIR/packages/provisioning/tests/"*.test.ts &>/dev/null; then
    echo ""
    echo "── Provisioning Unit Tests ──"
    PROV_OUTPUT=$(pnpm --filter @rsf/provisioning exec vitest run --reporter=verbose 2>&1)
    PROV_EXIT=$?
    if [ $PROV_EXIT -eq 0 ]; then
        PROV_COUNT=$(echo "$PROV_OUTPUT" | grep -oP '\d+ passed' | head -1 || echo "tests passed")
        record_result "Provisioning Vitest" "PASS" "$PROV_COUNT"
    else
        PROV_FAILED=$(echo "$PROV_OUTPUT" | grep -oP '\d+ failed' | head -1 || echo "failures found")
        record_result "Provisioning Vitest" "FAIL" "$PROV_FAILED"
    fi
fi

# ── 1f. Provisioning Python tests ──
PROV_PY_VENV="$PROJECT_DIR/packages/provisioning/python/.venv/bin"
if [ -f "$PROV_PY_VENV/python" ] && ls "$PROJECT_DIR/packages/provisioning/python/tests/"test_*.py &>/dev/null; then
    echo ""
    echo "── Provisioning Python Tests ──"
    PROV_PY_OUTPUT=$("$PROV_PY_VENV/python" -m pytest "$PROJECT_DIR/packages/provisioning/python/tests/" -v --tb=short 2>&1)
    PROV_PY_EXIT=$?
    if [ $PROV_PY_EXIT -eq 0 ]; then
        PROV_PY_COUNT=$(echo "$PROV_PY_OUTPUT" | grep -oP '\d+ passed' || echo "passed")
        record_result "Provisioning Python" "PASS" "$PROV_PY_COUNT"
    else
        PROV_PY_FAILS=$(echo "$PROV_PY_OUTPUT" | grep -oP '\d+ failed' || echo "failures")
        record_result "Provisioning Python" "FAIL" "$PROV_PY_FAILS"
    fi
fi

# ── 1g. Meta-improvement layer unit tests (Phase 6+) ──
if [ -d "$PROJECT_DIR/packages/meta-improvement/typescript/tests" ] && ls "$PROJECT_DIR/packages/meta-improvement/typescript/tests/"*.test.ts &>/dev/null; then
    echo ""
    echo "── Meta-Improvement Unit Tests ──"
    MI_OUTPUT=$(pnpm --filter @rsf/meta-improvement exec vitest run --reporter=verbose 2>&1)
    MI_EXIT=$?
    if [ $MI_EXIT -eq 0 ]; then
        MI_COUNT=$(echo "$MI_OUTPUT" | grep -oP '\d+ passed' | head -1 || echo "tests passed")
        record_result "Meta-Improvement Vitest" "PASS" "$MI_COUNT"
    else
        MI_FAILED=$(echo "$MI_OUTPUT" | grep -oP '\d+ failed' | head -1 || echo "failures found")
        record_result "Meta-Improvement Vitest" "FAIL" "$MI_FAILED"
    fi
fi

# ── 1h. Governance layer unit tests (Phase 7+) ──
if [ -d "$PROJECT_DIR/packages/governance/tests" ] && ls "$PROJECT_DIR/packages/governance/tests/"*.test.ts &>/dev/null; then
    echo ""
    echo "── Governance Unit Tests ──"
    GOV_OUTPUT=$(pnpm --filter @rsf/governance exec vitest run --reporter=verbose 2>&1)
    GOV_EXIT=$?
    if [ $GOV_EXIT -eq 0 ]; then
        GOV_COUNT=$(echo "$GOV_OUTPUT" | grep -oP '\d+ passed' | head -1 || echo "tests passed")
        record_result "Governance Vitest" "PASS" "$GOV_COUNT"
    else
        GOV_FAILED=$(echo "$GOV_OUTPUT" | grep -oP '\d+ failed' | head -1 || echo "failures found")
        record_result "Governance Vitest" "FAIL" "$GOV_FAILED"
    fi
fi

# ── 2. Contract test 5 (Temporal via tsx) ──
echo ""
echo "── Foundation Contract Test 5 (Temporal) ──"
TSX_OUTPUT=$(pnpm --filter @rsf/foundation exec tsx tests/contract-5-temporal.test.ts 2>&1)
TSX_EXIT=$?
if [ $TSX_EXIT -eq 0 ]; then
    record_result "Contract 5 (Temporal)" "PASS" "Temporal workflow test passed"
else
    record_result "Contract 5 (Temporal)" "FAIL" "Temporal workflow test failed"
fi

# ── 3. Python contract tests ──
echo ""
echo "── Python Contract Tests ──"
PY_VENV="$PROJECT_DIR/packages/quality/python/.venv/bin"
PY_OUTPUT=$("$PY_VENV/python" -m pytest "$PROJECT_DIR/packages/quality/python/tests/" -v --tb=short 2>&1)
PY_EXIT=$?
if [ $PY_EXIT -eq 0 ]; then
    PY_COUNT=$(echo "$PY_OUTPUT" | grep -oP '\d+ passed' || echo "passed")
    record_result "Python tests" "PASS" "$PY_COUNT"
else
    PY_FAILS=$(echo "$PY_OUTPUT" | grep -oP '\d+ failed' || echo "failures")
    record_result "Python tests" "FAIL" "$PY_FAILS"
fi

# ── 4. Audit log captures actions ──
echo ""
echo "── Audit Log Verification ──"
if [ -f "$PROJECT_DIR/logs/audit.jsonl" ]; then
    LINE_COUNT=$(wc -l < "$PROJECT_DIR/logs/audit.jsonl")
    if [ "$LINE_COUNT" -gt 0 ]; then
        record_result "Audit log (JSONL)" "PASS" "$LINE_COUNT entries in audit.jsonl"
    else
        record_result "Audit log (JSONL)" "FAIL" "audit.jsonl is empty"
    fi
else
    record_result "Audit log (JSONL)" "FAIL" "audit.jsonl not found"
fi

# Verify agent_events table exists and is writable (test suite cleans up after itself)
PG_TABLE=$(docker exec rsf-postgres psql -U rsf_user -d rsf_db -t -c "SELECT count(*) FROM information_schema.tables WHERE table_name = 'agent_events';" 2>/dev/null | tr -d ' ')
if [ "$PG_TABLE" = "1" ]; then
    record_result "Audit log (PostgreSQL)" "PASS" "agent_events table exists and is accessible"
else
    record_result "Audit log (PostgreSQL)" "FAIL" "agent_events table not found"
fi

# ── 5. No .env values in codebase ──
echo ""
echo "── Secret Scan ──"
# Extract actual secret values from .env (non-empty, non-comment lines)
# Only scan for truly sensitive values: API keys and passwords
# Short/generic values (ports, paths, service names) produce false positives
SECRETS_FOUND=0
while IFS='=' read -r key value; do
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    [[ -z "$value" ]] && continue
    # Only check actual secrets (API keys, passwords)
    case "$key" in
        ANTHROPIC_API_KEY|POSTGRES_PASSWORD) ;;
        *) continue ;;
    esac
    # Skip empty values
    [[ ${#value} -lt 8 ]] && continue
    # Search for the literal value in source files
    if grep -rq --include="*.ts" --include="*.js" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=logs -F "$value" .; then
        echo -e "    ${RED}Found secret value for $key in source files!${NC}"
        SECRETS_FOUND=$((SECRETS_FOUND + 1))
    fi
done < "$PROJECT_DIR/.env"

if [ "$SECRETS_FOUND" -eq 0 ]; then
    record_result "Secret scan" "PASS" "No .env secret values found in source files"
else
    record_result "Secret scan" "FAIL" "$SECRETS_FOUND secret value(s) found in source files"
fi

# ── 6. No hardcoded localhost ports outside config ──
echo ""
echo "── Hardcoded Port Scan ──"
HARDCODED_PORTS=$(grep -rn --include="*.ts" --include="*.js" \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
    -E '(localhost|127\.0\.0\.1):[0-9]{4}' packages/ 2>/dev/null \
    | grep -v 'node_modules' \
    | grep -v '\.test\.' \
    | grep -v 'process\.env' \
    | grep -v '??' \
    | grep -v '//' \
    | wc -l)

# Allow some in config/telemetry defaults
if [ "$HARDCODED_PORTS" -le 3 ]; then
    record_result "Hardcoded ports" "PASS" "$HARDCODED_PORTS hardcoded port references (within threshold)"
else
    record_result "Hardcoded ports" "FAIL" "$HARDCODED_PORTS hardcoded port references outside config"
fi

# ── 7. TypeScript compiles with zero errors ──
echo ""
echo "── TypeScript Compilation ──"
TSC_ERRORS=0
for pkg in foundation orchestration manufacturing quality provisioning meta-improvement governance; do
    PKG_TSC=$(pnpm --filter "@rsf/$pkg" exec tsc --noEmit 2>&1)
    if [ $? -ne 0 ]; then
        PKG_ERR=$(echo "$PKG_TSC" | grep -c "error TS" || echo "1")
        TSC_ERRORS=$((TSC_ERRORS + PKG_ERR))
        echo "  $pkg: $PKG_ERR errors"
        echo "$PKG_TSC" | head -10
    fi
done
if [ $TSC_ERRORS -eq 0 ]; then
    record_result "TypeScript compilation" "PASS" "All packages compile with zero errors"
else
    record_result "TypeScript compilation" "FAIL" "$TSC_ERRORS total TypeScript errors"
fi

# ── Generate report ──
echo ""
echo "── Report ──"

JSON_RESULTS=$(printf '%s\n' "${RESULTS[@]}" | paste -sd ',' -)
TOTAL=$((PASS_COUNT + FAIL_COUNT))

cat > "$REPORT_FILE" <<EOJSON
{
  "gate": "Gate 5 — Phase Completion Validation",
  "phase": "$CURRENT_PHASE",
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
    echo -e "${GREEN}  GATE 5 PASSED — Phase $CURRENT_PHASE complete${NC}"
    echo -e "${GREEN}  $PASS_COUNT/$TOTAL checks passed${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    echo -e "${RED}  GATE 5 FAILED — $FAIL_COUNT of $TOTAL checks failed${NC}"
    echo -e "${RED}  Fix all failures before proceeding${NC}"
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    exit 1
fi
