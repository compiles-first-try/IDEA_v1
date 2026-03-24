#!/usr/bin/env bash
set -euo pipefail

# Gate 3 — Infrastructure Health
# Starts all Docker Compose services, polls health checks until HEALTHY or timeout.
# Also verifies host Ollama and enables pgvector extension.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

REPORT_FILE="$PROJECT_DIR/gate3-report.json"
TIMEOUT_SECS=300  # 5 minutes
POLL_INTERVAL=5

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()

record_result() {
    local check_name="$1"
    local status="$2"
    local detail="$3"

    if [ "$status" = "PASS" ]; then
        PASS_COUNT=$((PASS_COUNT + 1))
        echo -e "  ${GREEN}✓ PASS${NC}  $check_name — $detail"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo -e "  ${RED}✗ FAIL${NC}  $check_name — $detail"
    fi

    # Escape double quotes in detail for JSON
    local safe_detail
    safe_detail=$(echo "$detail" | sed 's/"/\\"/g')
    RESULTS+=("{\"check\": \"$check_name\", \"status\": \"$status\", \"detail\": \"$safe_detail\"}")
}

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║       GATE 3 — INFRASTRUCTURE HEALTH            ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Start Docker Compose services ──
echo "── Starting Docker Compose services ──"
echo -e "  ${CYAN}Running docker compose up -d ...${NC}"
COMPOSE_OUTPUT=$(docker compose up -d 2>&1)
COMPOSE_EXIT=$?

if [ $COMPOSE_EXIT -ne 0 ]; then
    echo -e "  ${RED}docker compose up failed:${NC}"
    echo "$COMPOSE_OUTPUT"
    record_result "Docker Compose start" "FAIL" "docker compose up -d exited with code $COMPOSE_EXIT"
else
    echo -e "  ${GREEN}Docker Compose started successfully${NC}"
    record_result "Docker Compose start" "PASS" "All services started"
fi

echo ""

# ── Step 2: Poll health checks for each service ──
echo "── Waiting for services to reach HEALTHY state (timeout: ${TIMEOUT_SECS}s) ──"

# Services managed by Docker Compose (with health checks)
COMPOSE_SERVICES=("postgres" "redis" "temporal" "jaeger")
# Services without health checks (just need to be running)
RUNNING_SERVICES=("temporal-ui")

wait_for_healthy() {
    local service="$1"
    local elapsed=0

    while [ $elapsed -lt $TIMEOUT_SECS ]; do
        local health
        health=$(docker inspect --format='{{.State.Health.Status}}' "rsf-$service" 2>/dev/null || echo "not_found")

        case "$health" in
            healthy)
                return 0
                ;;
            unhealthy)
                # Check if it's still retrying or truly failed
                local retries
                retries=$(docker inspect --format='{{.State.Health.FailingStreak}}' "rsf-$service" 2>/dev/null || echo "0")
                # If failing streak is high, likely stuck
                if [ "$retries" -gt 20 ]; then
                    return 1
                fi
                ;;
            not_found)
                return 1
                ;;
        esac

        sleep "$POLL_INTERVAL"
        elapsed=$((elapsed + POLL_INTERVAL))
        echo -e "    ${YELLOW}⏳${NC} $service — waiting... (${elapsed}s / ${TIMEOUT_SECS}s)"
    done

    return 1  # timed out
}

wait_for_running() {
    local service="$1"
    local elapsed=0

    while [ $elapsed -lt $TIMEOUT_SECS ]; do
        local state
        state=$(docker inspect --format='{{.State.Status}}' "rsf-$service" 2>/dev/null || echo "not_found")

        if [ "$state" = "running" ]; then
            return 0
        fi

        sleep "$POLL_INTERVAL"
        elapsed=$((elapsed + POLL_INTERVAL))
        echo -e "    ${YELLOW}⏳${NC} $service — waiting to start... (${elapsed}s / ${TIMEOUT_SECS}s)"
    done

    return 1
}

# Poll health-checked services
for service in "${COMPOSE_SERVICES[@]}"; do
    echo -e "  ${CYAN}Checking $service...${NC}"
    if wait_for_healthy "$service"; then
        record_result "$service health" "PASS" "Container rsf-$service reached HEALTHY"
    else
        # Grab last health log for diagnostics
        HEALTH_LOG=$(docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' "rsf-$service" 2>/dev/null | tail -5)
        CONTAINER_LOGS=$(docker logs "rsf-$service" 2>&1 | tail -10)
        echo -e "    ${RED}Health log:${NC} $HEALTH_LOG"
        echo -e "    ${RED}Container logs (last 10):${NC}"
        echo "$CONTAINER_LOGS"
        record_result "$service health" "FAIL" "Container rsf-$service did not reach HEALTHY within ${TIMEOUT_SECS}s"
    fi
done

# Poll running-only services (no health check)
for service in "${RUNNING_SERVICES[@]}"; do
    echo -e "  ${CYAN}Checking $service...${NC}"
    if wait_for_running "$service"; then
        record_result "$service running" "PASS" "Container rsf-$service is running"
    else
        CONTAINER_LOGS=$(docker logs "rsf-$service" 2>&1 | tail -10)
        echo -e "    ${RED}Container logs (last 10):${NC}"
        echo "$CONTAINER_LOGS"
        record_result "$service running" "FAIL" "Container rsf-$service did not start within ${TIMEOUT_SECS}s"
    fi
done

echo ""

# ── Step 3: Verify host Ollama ──
echo "── Ollama (host) ──"
if curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
    record_result "Ollama reachable" "PASS" "Host Ollama responding at localhost:11434"
else
    record_result "Ollama reachable" "FAIL" "Host Ollama not responding at localhost:11434 — start Ollama or run: docker compose --profile ollama up -d"
fi

echo ""

# ── Step 4: Verify PostgreSQL accepts connections and enable pgvector ──
echo "── PostgreSQL connectivity ──"
PG_READY=$(docker exec rsf-postgres pg_isready -U rsf_user -d rsf_db 2>&1 || true)
if echo "$PG_READY" | grep -q "accepting connections"; then
    record_result "PostgreSQL connectivity" "PASS" "Accepting connections as rsf_user on rsf_db"

    # Enable pgvector extension
    PGVECTOR_OUTPUT=$(docker exec rsf-postgres psql -U rsf_user -d rsf_db -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>&1 || true)
    PGVECTOR_CHECK=$(docker exec rsf-postgres psql -U rsf_user -d rsf_db -t -c "SELECT extname FROM pg_extension WHERE extname = 'vector';" 2>&1 || true)
    if echo "$PGVECTOR_CHECK" | grep -q "vector"; then
        record_result "pgvector extension" "PASS" "pgvector extension loaded in rsf_db"
    else
        record_result "pgvector extension" "FAIL" "Could not enable pgvector: $PGVECTOR_OUTPUT"
    fi
else
    record_result "PostgreSQL connectivity" "FAIL" "Cannot connect: $PG_READY"
    record_result "pgvector extension" "FAIL" "Skipped — PostgreSQL not ready"
fi

echo ""

# ── Step 5: Verify Redis accepts connections ──
echo "── Redis connectivity ──"
REDIS_PING=$(docker exec rsf-redis redis-cli ping 2>&1 || true)
if [ "$REDIS_PING" = "PONG" ]; then
    record_result "Redis connectivity" "PASS" "redis-cli ping returned PONG"
else
    record_result "Redis connectivity" "FAIL" "redis-cli ping returned: $REDIS_PING"
fi

echo ""

# ── Step 6: Verify Temporal accepts connections ──
echo "── Temporal connectivity ──"
TEMPORAL_IP=$(docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' rsf-temporal 2>/dev/null || echo "")
if [ -n "$TEMPORAL_IP" ]; then
    TEMPORAL_HEALTH=$(docker exec rsf-temporal temporal operator cluster health --address "${TEMPORAL_IP}:7233" 2>&1 || true)
else
    TEMPORAL_HEALTH=$(docker exec rsf-temporal temporal operator cluster health 2>&1 || true)
fi
if echo "$TEMPORAL_HEALTH" | grep -qi "SERVING\|ok\|healthy"; then
    record_result "Temporal connectivity" "PASS" "Temporal cluster is serving"
else
    record_result "Temporal connectivity" "FAIL" "Temporal health: $TEMPORAL_HEALTH"
fi

echo ""

# ── Step 7: Verify Jaeger UI is accessible ──
echo "── Jaeger connectivity ──"
JAEGER_CHECK=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:16686/ 2>/dev/null || echo "000")
if [ "$JAEGER_CHECK" = "200" ]; then
    record_result "Jaeger UI" "PASS" "Jaeger UI accessible at localhost:16686 (HTTP 200)"
else
    record_result "Jaeger UI" "FAIL" "Jaeger UI returned HTTP $JAEGER_CHECK at localhost:16686"
fi

echo ""

# ── Step 8: Final docker compose status snapshot ──
echo "── Docker Compose status ──"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker compose ps
echo ""

# ── Generate JSON report ──
echo "── Report ──"

JSON_RESULTS=$(printf '%s\n' "${RESULTS[@]}" | paste -sd ',' -)

# Capture service details for the report
SERVICE_DETAILS=$(docker compose ps --format json 2>/dev/null || echo "[]")

cat > "$REPORT_FILE" <<EOJSON
{
  "gate": "Gate 3 — Infrastructure Health",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "summary": {
    "total": $((PASS_COUNT + FAIL_COUNT)),
    "passed": $PASS_COUNT,
    "failed": $FAIL_COUNT
  },
  "results": [$JSON_RESULTS],
  "services": {
    "postgres": {
      "container": "rsf-postgres",
      "image": "pgvector/pgvector:pg16",
      "port": 5432,
      "extensions": ["vector"]
    },
    "redis": {
      "container": "rsf-redis",
      "image": "redis:7.2-alpine",
      "port": 6379
    },
    "temporal": {
      "container": "rsf-temporal",
      "image": "temporalio/auto-setup:1.24",
      "port": 7233
    },
    "temporal_ui": {
      "container": "rsf-temporal-ui",
      "image": "temporalio/ui:2.26.2",
      "port": 8080
    },
    "jaeger": {
      "container": "rsf-jaeger",
      "image": "jaegertracing/all-in-one:1.58",
      "ports": {
        "ui": 16686,
        "collector": 14268,
        "otlp_grpc": 4317,
        "otlp_http": 4318
      }
    },
    "ollama": {
      "type": "host",
      "url": "http://localhost:11434"
    }
  }
}
EOJSON

echo "  Report written to: $REPORT_FILE"
echo ""

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  GATE 3 PASSED — All $PASS_COUNT checks passed${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    echo -e "${RED}  GATE 3 FAILED — $FAIL_COUNT of $((PASS_COUNT + FAIL_COUNT)) checks failed${NC}"
    echo -e "${RED}  Fix all failures before proceeding to Gate 4${NC}"
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    exit 1
fi
