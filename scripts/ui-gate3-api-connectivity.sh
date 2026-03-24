#!/usr/bin/env bash
set -uo pipefail

# UI Gate 3 — Governance API Connectivity
# Verifies the desktop UI can reach all governance API endpoints + WebSocket.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

REPORT_FILE="$PROJECT_DIR/ui-gate3-report.json"
API_BASE="http://localhost:3000"
WS_URL="ws://localhost:3000/audit-stream"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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
echo "║       UI GATE 3 — API CONNECTIVITY              ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Test 1: GET /health ──
echo "── Test 1: GET /health ──"
HEALTH_RESP=$(curl -sf "$API_BASE/health" 2>/dev/null)
HEALTH_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$API_BASE/health" 2>/dev/null || echo "000")
if [ "$HEALTH_CODE" = "200" ]; then
    STATUS=$(echo "$HEALTH_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
    if [ "$STATUS" = "ok" ]; then
        record_result "GET /health" "PASS" "HTTP 200, status=ok"
    else
        record_result "GET /health" "FAIL" "HTTP 200 but status=$STATUS"
    fi
else
    record_result "GET /health" "FAIL" "HTTP $HEALTH_CODE — API not reachable at $API_BASE"
fi

# ── Test 2: GET /governance/status ──
echo ""
echo "── Test 2: GET /governance/status ──"
STATUS_RESP=$(curl -sf "$API_BASE/governance/status" 2>/dev/null)
STATUS_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$API_BASE/governance/status" 2>/dev/null || echo "000")
if [ "$STATUS_CODE" = "200" ]; then
    # Validate shape: must have killSwitchActive, dailySpend, timestamp
    HAS_FIELDS=$(echo "$STATUS_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ok = 'killSwitchActive' in d and 'dailySpend' in d and 'timestamp' in d
print('valid' if ok else 'invalid')
" 2>/dev/null || echo "invalid")
    if [ "$HAS_FIELDS" = "valid" ]; then
        record_result "GET /governance/status" "PASS" "HTTP 200, valid shape (killSwitchActive, dailySpend, timestamp)"
    else
        record_result "GET /governance/status" "FAIL" "HTTP 200 but missing required fields"
    fi
else
    record_result "GET /governance/status" "FAIL" "HTTP $STATUS_CODE"
fi

# ── Test 3: GET /governance/audit ──
echo ""
echo "── Test 3: GET /governance/audit ──"
AUDIT_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$API_BASE/governance/audit?limit=5" 2>/dev/null || echo "000")
AUDIT_RESP=$(curl -sf "$API_BASE/governance/audit?limit=5" 2>/dev/null)
if [ "$AUDIT_CODE" = "200" ]; then
    IS_ARRAY=$(echo "$AUDIT_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('valid' if 'events' in d and isinstance(d['events'], list) else 'invalid')
" 2>/dev/null || echo "invalid")
    if [ "$IS_ARRAY" = "valid" ]; then
        EVENT_COUNT=$(echo "$AUDIT_RESP" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['events']))" 2>/dev/null || echo "0")
        record_result "GET /governance/audit" "PASS" "HTTP 200, events array with $EVENT_COUNT items"
    else
        record_result "GET /governance/audit" "FAIL" "HTTP 200 but response is not {events: [...]}"
    fi
else
    record_result "GET /governance/audit" "FAIL" "HTTP $AUDIT_CODE"
fi

# ── Test 4: GET /governance/config ──
echo ""
echo "── Test 4: GET /governance/config ──"
CONFIG_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$API_BASE/governance/config" 2>/dev/null || echo "000")
CONFIG_RESP=$(curl -sf "$API_BASE/governance/config" 2>/dev/null)
if [ "$CONFIG_CODE" = "200" ]; then
    HAS_CONFIG=$(echo "$CONFIG_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ok = 'maxDailySpendUsd' in d and 'autonomyLevel' in d
print('valid' if ok else 'invalid')
" 2>/dev/null || echo "invalid")
    if [ "$HAS_CONFIG" = "valid" ]; then
        record_result "GET /governance/config" "PASS" "HTTP 200, valid config shape (maxDailySpendUsd, autonomyLevel)"
    else
        record_result "GET /governance/config" "FAIL" "HTTP 200 but missing config fields"
    fi
else
    record_result "GET /governance/config" "FAIL" "HTTP $CONFIG_CODE"
fi

# ── Test 5: WebSocket /audit-stream ──
echo ""
echo "── Test 5: WebSocket /audit-stream ──"

# Use a small Node.js script to test WebSocket connectivity
# Resolve ws from the pnpm store since it's not hoisted to root
WS_PATH=$(ls "$PROJECT_DIR"/node_modules/.pnpm/ws@*/node_modules/ws/index.js 2>/dev/null | head -1)
WS_RESULT=$(timeout 10 node -e "
const WebSocket = require('$WS_PATH');
const ws = new WebSocket('$WS_URL');
let received = false;
ws.on('open', () => { /* wait for message */ });
ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    if (msg.type) {
      console.log('OK:' + msg.type);
      received = true;
      ws.close();
      process.exit(0);
    }
  } catch {}
});
ws.on('error', (err) => {
  console.log('ERROR:' + err.message);
  process.exit(1);
});
setTimeout(() => {
  if (!received) {
    console.log('TIMEOUT');
    ws.close();
    process.exit(1);
  }
}, 8000);
" 2>&1 || echo "TIMEOUT")

if echo "$WS_RESULT" | grep -q "OK:connected"; then
    record_result "WebSocket /audit-stream" "PASS" "Connected, received 'connected' message"
elif echo "$WS_RESULT" | grep -q "OK:"; then
    MSG_TYPE=$(echo "$WS_RESULT" | grep -oP 'OK:\K.*')
    record_result "WebSocket /audit-stream" "PASS" "Connected, received '$MSG_TYPE' message"
else
    record_result "WebSocket /audit-stream" "FAIL" "Result: $WS_RESULT"
fi

# ── Generate report ──
echo ""
echo "── Report ──"

JSON_RESULTS=$(printf '%s\n' "${RESULTS[@]}" | paste -sd ',' -)
TOTAL=$((PASS_COUNT + FAIL_COUNT))

cat > "$REPORT_FILE" <<EOJSON
{
  "gate": "UI Gate 3 — API Connectivity",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "api_base": "$API_BASE",
  "ws_url": "$WS_URL",
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
    echo -e "${GREEN}  UI GATE 3 PASSED — $PASS_COUNT/$TOTAL connectivity tests passed${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    echo -e "${RED}  UI GATE 3 FAILED — $FAIL_COUNT of $TOTAL tests failed${NC}"
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    exit 1
fi
