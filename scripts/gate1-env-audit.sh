#!/usr/bin/env bash
set -euo pipefail

# Gate 1 — Environment Audit Script
# Checks all required tools, versions, and services before proceeding.

REPORT_FILE="$(dirname "$0")/../gate1-report.json"
PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Minimum required versions
NODE_MIN="22.0.0"
PYTHON_MIN="3.11.0"
DOCKER_MIN="24.0.0"
GIT_MIN="2.40.0"
PNPM_MIN="9.0.0"

# --- Helper functions ---

version_gte() {
    # Returns 0 if $1 >= $2 (using sort -V)
    [ "$(printf '%s\n%s' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

record_result() {
    local check_name="$1"
    local status="$2"
    local detail="$3"
    local fix="${4:-}"

    if [ "$status" = "PASS" ]; then
        PASS_COUNT=$((PASS_COUNT + 1))
        echo -e "  ${GREEN}✓ PASS${NC}  $check_name — $detail"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo -e "  ${RED}✗ FAIL${NC}  $check_name — $detail"
        if [ -n "$fix" ]; then
            echo -e "         ${YELLOW}Fix:${NC} $fix"
        fi
    fi

    RESULTS+=("{\"check\": \"$check_name\", \"status\": \"$status\", \"detail\": \"$detail\"}")
}

# --- Checks ---

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║       GATE 1 — ENVIRONMENT AUDIT                ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# 1. Check WSL2 (not WSL1)
echo "── Platform ──"
if grep -qi "microsoft" /proc/version 2>/dev/null; then
    WSL_VERSION=$(uname -r)
    if echo "$WSL_VERSION" | grep -qi "WSL2\|microsoft-standard-WSL2"; then
        record_result "WSL2" "PASS" "Running on WSL2 ($WSL_VERSION)"
    else
        record_result "WSL2" "FAIL" "Detected WSL1 or unknown ($WSL_VERSION)" \
            "Upgrade to WSL2: wsl --set-version <distro> 2"
    fi
else
    record_result "WSL2" "PASS" "Not running in WSL (native Linux assumed: $(uname -r))"
fi

# 2. Git
echo ""
echo "── Tool Versions ──"
if command -v git &>/dev/null; then
    GIT_VER=$(git --version | grep -oP '\d+\.\d+\.\d+')
    if version_gte "$GIT_VER" "$GIT_MIN"; then
        record_result "Git" "PASS" "v$GIT_VER (>= $GIT_MIN)"
    else
        record_result "Git" "FAIL" "v$GIT_VER (need >= $GIT_MIN)" \
            "sudo apt update && sudo apt install -y git"
    fi
else
    record_result "Git" "FAIL" "git not found" \
        "sudo apt update && sudo apt install -y git"
fi

# 3. Node.js
if command -v node &>/dev/null; then
    NODE_VER=$(node --version | sed 's/^v//')
    if version_gte "$NODE_VER" "$NODE_MIN"; then
        record_result "Node.js" "PASS" "v$NODE_VER (>= $NODE_MIN)"
    else
        record_result "Node.js" "FAIL" "v$NODE_VER (need >= $NODE_MIN)" \
            "nvm install 22 && nvm use 22"
    fi
else
    record_result "Node.js" "FAIL" "node not found" \
        "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && nvm install 22"
fi

# 4. pnpm
if command -v pnpm &>/dev/null; then
    PNPM_VER=$(pnpm --version)
    if version_gte "$PNPM_VER" "$PNPM_MIN"; then
        record_result "pnpm" "PASS" "v$PNPM_VER (>= $PNPM_MIN)"
    else
        record_result "pnpm" "FAIL" "v$PNPM_VER (need >= $PNPM_MIN)" \
            "corepack enable && corepack prepare pnpm@latest --activate"
    fi
else
    record_result "pnpm" "FAIL" "pnpm not found" \
        "corepack enable && corepack prepare pnpm@latest --activate"
fi

# 5. Python — check python3 first, fall back to python3.11
PY_CMD=""
if command -v python3 &>/dev/null; then
    PY_VER=$(python3 --version | grep -oP '\d+\.\d+(\.\d+)?')
    if version_gte "$PY_VER" "$PYTHON_MIN"; then
        PY_CMD="python3"
    fi
fi
if [ -z "$PY_CMD" ] && command -v python3.11 &>/dev/null; then
    PY_VER=$(python3.11 --version | grep -oP '\d+\.\d+(\.\d+)?')
    if version_gte "$PY_VER" "$PYTHON_MIN"; then
        PY_CMD="python3.11"
    fi
fi

if [ -n "$PY_CMD" ]; then
    PY_VER=$($PY_CMD --version | grep -oP '\d+\.\d+(\.\d+)?')
    record_result "Python" "PASS" "v$PY_VER via $PY_CMD (>= $PYTHON_MIN)"
else
    FOUND_VER=""
    if command -v python3 &>/dev/null; then
        FOUND_VER=$(python3 --version | grep -oP '\d+\.\d+(\.\d+)?')
    fi
    record_result "Python" "FAIL" "v${FOUND_VER:-not found} (need >= $PYTHON_MIN)" \
        "sudo apt install -y python3.11 python3.11-venv"
fi

# 6. Docker
echo ""
echo "── Docker ──"
if command -v docker &>/dev/null; then
    DOCKER_VER=$(timeout 10 docker --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1)
    if [ -n "$DOCKER_VER" ] && version_gte "$DOCKER_VER" "$DOCKER_MIN"; then
        record_result "Docker version" "PASS" "v$DOCKER_VER (>= $DOCKER_MIN)"
    elif [ -n "$DOCKER_VER" ]; then
        record_result "Docker version" "FAIL" "v$DOCKER_VER (need >= $DOCKER_MIN)" \
            "Update Docker Desktop or: curl -fsSL https://get.docker.com | sh"
    else
        record_result "Docker version" "FAIL" "docker command timed out or returned no version" \
            "Ensure Docker Desktop is running, or: curl -fsSL https://get.docker.com | sh"
    fi
else
    record_result "Docker version" "FAIL" "docker not found" \
        "Install Docker Desktop with WSL2 backend, or: curl -fsSL https://get.docker.com | sh"
fi

# 7. Docker running
if timeout 10 docker info &>/dev/null 2>&1; then
    record_result "Docker running" "PASS" "Docker daemon is responsive"
else
    record_result "Docker running" "FAIL" "Docker daemon not running or timed out" \
        "Start Docker Desktop, or: sudo service docker start"
fi

# 8. Docker can pull and run
if timeout 10 docker info &>/dev/null 2>&1; then
    if timeout 30 docker run --rm hello-world &>/dev/null 2>&1; then
        record_result "Docker pull/run" "PASS" "Successfully ran hello-world container"
    else
        record_result "Docker pull/run" "FAIL" "Cannot pull/run containers" \
            "Check Docker permissions: sudo usermod -aG docker \$USER && newgrp docker"
    fi
else
    record_result "Docker pull/run" "FAIL" "Skipped (Docker not running)"
fi

# 9. NVIDIA GPU in WSL2
echo ""
echo "── GPU ──"
if command -v nvidia-smi &>/dev/null; then
    if nvidia-smi &>/dev/null 2>&1; then
        GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1 || echo "unknown")
        VRAM_MB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1 || echo "0")
        VRAM_GB=$((VRAM_MB / 1024))
        record_result "NVIDIA GPU" "PASS" "$GPU_NAME detected"

        if [ "$VRAM_GB" -ge 14 ]; then
            record_result "GPU VRAM" "PASS" "${VRAM_GB}GB (>= 14GB for qwen2.5-coder:14b)"
        else
            record_result "GPU VRAM" "FAIL" "${VRAM_GB}GB (need >= 14GB for qwen2.5-coder:14b)" \
                "Consider a smaller model (qwen2.5-coder:7b) or use cloud inference only"
        fi
    else
        record_result "NVIDIA GPU" "FAIL" "nvidia-smi failed" \
            "Install NVIDIA CUDA driver for WSL2: https://developer.nvidia.com/cuda/wsl"
        record_result "GPU VRAM" "FAIL" "Skipped (no GPU detected)"
    fi
else
    record_result "NVIDIA GPU" "FAIL" "nvidia-smi not found" \
        "Install NVIDIA CUDA driver for WSL2: https://developer.nvidia.com/cuda/wsl"
    record_result "GPU VRAM" "FAIL" "Skipped (nvidia-smi not available)"
fi

# 10. Ollama
echo ""
echo "── Services ──"
if curl -s --max-time 5 http://localhost:11434/api/tags &>/dev/null; then
    record_result "Ollama" "PASS" "Reachable at localhost:11434"
else
    record_result "Ollama" "FAIL" "Not reachable at localhost:11434" \
        "Install: curl -fsSL https://ollama.com/install.sh | sh && ollama serve"
fi

# 11-14. Port conflicts
check_port() {
    local port=$1
    local service=$2
    if ss -tlnp 2>/dev/null | grep -q ":${port} " || \
       netstat -tlnp 2>/dev/null | grep -q ":${port} "; then
        record_result "Port $port ($service)" "FAIL" "Port $port is already in use" \
            "Find process: sudo lsof -i :$port  or  ss -tlnp | grep :$port"
    else
        record_result "Port $port ($service)" "PASS" "Port $port is available"
    fi
}

check_port 5432 "PostgreSQL"
check_port 6379 "Redis"
check_port 7233 "Temporal"
check_port 16686 "Jaeger"

# --- Generate JSON report ---
echo ""
echo "── Report ──"

JSON_RESULTS=$(printf '%s\n' "${RESULTS[@]}" | paste -sd ',' -)

cat > "$REPORT_FILE" <<EOJSON
{
  "gate": "Gate 1 — Environment Audit",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "summary": {
    "total": $((PASS_COUNT + FAIL_COUNT)),
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
    echo -e "${GREEN}  GATE 1 PASSED — All $PASS_COUNT checks passed${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    echo -e "${RED}  GATE 1 FAILED — $FAIL_COUNT of $((PASS_COUNT + FAIL_COUNT)) checks failed${NC}"
    echo -e "${RED}  Fix all failures before proceeding to Gate 2${NC}"
    echo -e "${RED}══════════════════════════════════════════════════${NC}"
    exit 1
fi
