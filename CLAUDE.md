# RECURSIVE SOFTWARE FOUNDRY — CLAUDE CODE MASTER SPECIFICATION
## Version: 1.0.0 | Environment: Windows 11 + WSL2 | Status: V1 Build

---

## CRITICAL OPERATING RULES — READ BEFORE ANYTHING ELSE

These rules are non-negotiable and override any default Claude Code behavior:

1. **NEVER assume anything.** If a requirement is ambiguous, stop and ask a clarifying question before proceeding.
2. **NEVER hardcode secrets, API keys, passwords, connection strings, or tokens in any file.** All secrets go through the `.env` file loaded by dotenv-vault. `.env` is always in `.gitignore`.
3. **NEVER skip a compatibility gate.** If Gate 1 through Gate 5 have not passed for the current phase, do not proceed.
4. **NEVER write implementation code before writing its tests.** Tests are written first. Implementation follows. This is test-driven development — no exceptions.
5. **NEVER generate code that executes outside a Docker sandbox.** All generated application code runs inside isolated Docker containers.
6. **ALWAYS log every agent action, tool call, LLM invocation, and decision to both the structured JSON audit log and the PostgreSQL events table.**
7. **ALWAYS implement the kill switch before any agent loop is activated.**
8. **If you are uncertain whether two components are compatible, write and run a contract test before writing any code that depends on both.**
9. **Ask for clarification rather than making assumptions about requirements, edge cases, or behavior.**
10. **Surface non-obvious problems proactively.** If you see a risk, design flaw, or missing requirement the user has not mentioned, flag it explicitly before proceeding.
11. **NEVER use SELECT * in any database query — always name columns explicitly.** Schema changes should only break agents that use changed columns, not every agent.
12. **Every governance API response MUST include a `schema_version` field** (currently `"2"` after V2 migration). Consumers use this to detect schema drift.
13. **All agent database queries MUST use explicit column lists.** This is the agent-layer enforcement of rule 11.

---

## PROJECT IDENTITY

**Name:** Recursive Software Foundry (RSF)
**Purpose:** A self-sustaining, self-improving software manufacturing system that:
- Produces general-purpose enterprise software from specifications
- Manufactures its own agent blueprints, prompts, skills, and MCP servers
- Builds progressively better versions of itself (each generation produces higher quality / fewer defects than the last)
- Operates on a hybrid local/cloud inference model
- Runs locally on Windows 11 + WSL2 for V1
- Is observable, auditable, and killable at any moment

**Theoretical Foundation (inform all architectural decisions):**
- Von Neumann Universal Constructor: requires Universal Constructor (A), Universal Copier (B), Description store (Φ), and Improvement automaton (D)
- Kleene Recursion Theorem: self-referential programs exist in every Turing-complete system; improvement operators converge to fixed points — design escape mechanisms
- Rice's Theorem: full automated quality verification is provably impossible; use defense-in-depth (types + tests + formal verification of critical paths)
- Information-theoretic self-improvement bound: closed improvement loops collapse; external verification signals (test suites, formal specs, user feedback) are mandatory — never let the system evaluate itself with metrics it also optimizes

---

## HOST ENVIRONMENT

```
OS:           Windows 11 + WSL2 (Ubuntu preferred inside WSL2)
CPU:          12-core / 24-thread @ 4.2GHz (AMD or Intel — detect at runtime)
RAM:          64GB DDR4 @ 3400MHz
GPU:          NVIDIA RTX 5070 Ti (16GB VRAM) — used for local LLM inference via Ollama
Storage:      1TB SSD
Motherboard:  ASUS ROG Strix B550-F
Primary IDE:  VS Code with Claude Code extension
```

**IMPORTANT:** Before writing any code, run the environment audit script (Gate 1). Tool versions on this machine are unknown and may be outdated. Do not assume any tool is at the required version.

---

## LANGUAGE ASSIGNMENTS BY LAYER

| Layer | Language | Rationale |
|-------|----------|-----------|
| Orchestration, Agent Definitions, MCP Servers, API Gateway | TypeScript (Node.js) | Type safety, Mastra native, MCP SDK native |
| Evaluation, Prompt Optimization, Data Science, Local Model Management | Python 3.11+ | DSPy, Hypothesis, pytest, Ollama Python SDK |
| Infrastructure, Docker, CI scripts | Shell (bash inside WSL2) | Cross-platform via WSL2 |
| Database migrations | SQL (Flyway or raw psql) | Explicit, version-controlled schema |
| C# / .NET | Reserved for Phase 5+ enterprise integrations | Not used in V1 |

---

## REQUIRED TECH STACK — EXACT VERSIONS

### Inference Layer
- **Local (primary for cheap/fast tasks):** Ollama latest stable on WSL2/Windows
  - Primary coding model: `qwen2.5-coder:14b` (fits in 16GB VRAM)
  - General routing model: `llama3.3:8b`
  - Embeddings: `nomic-embed-text:latest`
- **Cloud (heavy reasoning, self-improvement cycles):** Anthropic Claude API
  - Primary: `claude-sonnet-4-6` (1M context, best reasoning)
  - Cheap/fast: `claude-haiku-3-5` (formatting, classification, routing)
- **Model Router:** Implement difficulty-aware routing — classify every task as TRIVIAL / STANDARD / COMPLEX / CRITICAL before dispatching. TRIVIAL and STANDARD go to local Ollama. COMPLEX goes to Haiku. CRITICAL goes to Sonnet.

### Orchestration
- **Mastra** `^0.10.0` — primary agent framework (TypeScript)
- **LangGraph.js** `^0.2.0` — graph-based state machines for complex multi-step workflows
- **Temporal.io** `^1.11.0` (TypeScript SDK) — durable workflow execution for long-running factory jobs

### Data Layer
- **PostgreSQL** `16.x` + **pgvector** extension `0.7.x` — relational store, event log, AND vector store (no separate vector DB)
- **Redis** `7.2.x` — working memory, session cache, agent state (< 1ms reads)
- **Flyway** for database migrations (version-controlled, never manual schema changes)

### Security
- **dotenv-vault** `^1.25.0` — local secret management, `.env` never committed
- **Docker** containers — all generated code executes inside isolated containers
- **helmet** `^8.0.0` — HTTP security headers on all Express endpoints
- **zod** `^3.23.0` — runtime input validation on all external inputs

### Observability
- **OpenTelemetry** JS SDK `^1.25.0` — traces, metrics, logs
- **Pino** `^9.0.0` — structured JSON logging (Node.js)
- **Python logging** with JSON formatter — structured logging (Python layer)
- **Jaeger** `latest` (Docker container) — distributed trace visualization
- **Audit Log:** Append-only JSON log file (`/logs/audit.jsonl`) + PostgreSQL `agent_events` table — EVERY agent action, LLM call, tool invocation, and decision must be recorded with timestamp, agent_id, action_type, inputs, outputs, duration_ms, model_used, tokens_in, tokens_out, cost_usd

### Testing
- **Vitest** `^2.0.0` — TypeScript unit + integration tests
- **fast-check** `^3.19.0` — TypeScript property-based testing
- **pytest** `^8.2.0` + **Hypothesis** `^6.100.0` — Python property-based testing
- **Testcontainers** `^3.9.0` — spin up real Docker containers in tests (not mocks)

### Node.js toolchain
- **Node.js** `22.x LTS` (verify with `node --version`, upgrade via nvm if needed)
- **pnpm** `^9.0.0` (preferred over npm for workspace support)
- **TypeScript** `^5.5.0`
- **tsx** `^4.15.0` for running TypeScript directly

### Python toolchain
- **Python** `3.11+` (verify with `python --version`)
- **uv** `^0.4.0` (preferred over pip for fast, reproducible installs)
- **DSPy** `^2.5.0` — automated prompt optimization
- **Anthropic Python SDK** `^0.30.0`
- **Ollama Python SDK** `^0.3.0`

---

## ARCHITECTURE — SEVEN LAYERS

Build in this exact order. Do not skip layers. Do not build a higher layer before the lower layer passes all contract tests.

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 7: HUMAN GOVERNANCE                                      │
│  Kill switch · Audit dashboard · Approval gates · Config UI    │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 6: META-IMPROVEMENT (Autopoietic)                        │
│  Evolutionary agent search · Prompt optimization (DSPy)        │
│  Quality-diversity archive · Regression budget manager          │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 5: COMPONENT PROVISIONING (Self-Manufacturing)           │
│  Agent blueprint gen · Tool synthesis · MCP server gen         │
│  Skill authoring · Schema synthesis · IaC generation           │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 4: QUALITY ASSURANCE                                     │
│  Metamorphic testing · Differential testing · PBT              │
│  Mutation testing · Multi-model consensus gates                 │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: MANUFACTURING (Allopoietic)                           │
│  Code generation · AST validation · Program repair             │
│  Spec-driven development · Test-first generation               │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: ORCHESTRATION                                         │
│  Mastra agents · LangGraph workflows · Temporal durability     │
│  Model router · Behavioral contracts · Agent audit logging     │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 1: FOUNDATION (Food Set)                                 │
│  PostgreSQL+pgvector · Redis · Docker sandbox · Ollama         │
│  Anthropic API · OpenTelemetry · Jaeger · Secret management    │
└─────────────────────────────────────────────────────────────────┘
```

---

## PROJECT DIRECTORY STRUCTURE

Generate this exact structure. Do not deviate without asking first.

```
rsf/
├── CLAUDE.md                          # This file — Claude Code reads it every session
├── .env.example                       # Template with all required env vars (no values)
├── .env                               # Actual secrets — NEVER committed (in .gitignore)
├── .gitignore                         # Must include .env, node_modules, __pycache__, *.pyc
├── docker-compose.yml                 # All infrastructure services
├── docker-compose.test.yml            # Test infrastructure (separate ports)
├── package.json                       # Root workspace (pnpm workspaces)
├── pnpm-workspace.yaml
├── tsconfig.base.json                 # Shared TypeScript config
│
├── scripts/
│   ├── gate1-env-audit.sh             # Gate 1: Environment version check
│   ├── gate2-deps-resolve.sh          # Gate 2: Dependency resolution
│   ├── gate3-infra-health.sh          # Gate 3: Docker health checks
│   ├── gate4-contract-tests.sh        # Gate 4: Cross-layer contract tests
│   ├── gate5-phase-validate.sh        # Gate 5: Phase completion validation
│   ├── kill-switch.sh                 # Emergency stop all agents
│   └── setup-wsl2.sh                  # One-time WSL2 environment setup
│
├── packages/
│   ├── foundation/                    # Layer 1 — TypeScript
│   │   ├── src/
│   │   │   ├── db/                    # PostgreSQL + pgvector client
│   │   │   ├── cache/                 # Redis client
│   │   │   ├── secrets/               # dotenv-vault loader
│   │   │   ├── sandbox/               # Docker execution sandbox
│   │   │   ├── telemetry/             # OpenTelemetry setup
│   │   │   └── audit/                 # Audit log writer
│   │   └── tests/
│   │
│   ├── orchestration/                 # Layer 2 — TypeScript
│   │   ├── src/
│   │   │   ├── agents/                # Mastra agent definitions
│   │   │   ├── workflows/             # LangGraph state machines
│   │   │   ├── temporal/              # Temporal workflow definitions
│   │   │   ├── router/                # Difficulty-aware model router
│   │   │   ├── contracts/             # Agent Behavioral Contracts
│   │   │   └── kill-switch/           # Kill switch implementation
│   │   └── tests/
│   │
│   ├── manufacturing/                 # Layer 3 — TypeScript
│   │   ├── src/
│   │   │   ├── generator/             # Code generation engine
│   │   │   ├── ast/                   # AST-level manipulation
│   │   │   ├── repair/                # Automated program repair
│   │   │   └── spec-interpreter/      # Spec → structured generation targets
│   │   └── tests/
│   │
│   ├── quality/                       # Layer 4 — TypeScript + Python
│   │   ├── typescript/
│   │   │   ├── src/
│   │   │   │   ├── metamorphic/       # Metamorphic test generator
│   │   │   │   ├── differential/      # N-version differential testing
│   │   │   │   ├── consensus/         # Multi-model consensus gate
│   │   │   │   └── mutation/          # Mutation test runner
│   │   │   └── tests/
│   │   └── python/
│   │       ├── evaluations/           # DSPy-based evaluations
│   │       ├── pbt/                   # Hypothesis property-based tests
│   │       └── tests/
│   │
│   ├── provisioning/                  # Layer 5 — TypeScript + Python
│   │   ├── src/
│   │   │   ├── blueprint-gen/         # Agent blueprint generation
│   │   │   ├── tool-synth/            # Tool synthesis
│   │   │   ├── mcp-gen/               # MCP server generation from OpenAPI
│   │   │   ├── skill-author/          # Skill gap detection + authoring
│   │   │   └── schema-synth/          # Database schema synthesis
│   │   └── tests/
│   │
│   ├── meta-improvement/              # Layer 6 — Python + TypeScript
│   │   ├── python/
│   │   │   ├── prompt_optimizer/      # DSPy MIPROv2 prompt optimization
│   │   │   ├── agent_search/          # ADAS-style agent blueprint search
│   │   │   └── quality_archive/       # Quality-diversity archive
│   │   └── typescript/
│   │       ├── src/
│   │       │   ├── regression-budget/ # Regression budget manager
│   │       │   └── improvement-loop/  # Orchestrates improvement cycles
│   │       └── tests/
│   │
│   └── governance/                    # Layer 7 — TypeScript
│       ├── src/
│       │   ├── api/                   # REST API (Express + Zod)
│       │   ├── audit-dashboard/       # Audit log viewer
│       │   └── config/                # Runtime configuration UI
│       └── tests/
│
├── db/
│   └── migrations/                    # Flyway SQL migrations (numbered, versioned)
│
├── docker/
│   ├── sandbox/                       # Dockerfile for generated code sandbox
│   └── services/                      # Dockerfiles for custom services
│
├── logs/
│   └── audit.jsonl                    # Append-only audit log (gitignored)
│
└── skills/                            # Agent skill library (SKILL.md files)
    └── .gitkeep
```

---

## GATE 1 — ENVIRONMENT AUDIT SCRIPT

This is the FIRST thing to generate and run. Do not proceed until this script passes.

`scripts/gate1-env-audit.sh` must check and report:

```bash
# Minimum required versions
NODE_MIN="22.0.0"
PYTHON_MIN="3.11.0"
DOCKER_MIN="24.0.0"
GIT_MIN="2.40.0"
PNPM_MIN="9.0.0"

# Check WSL2 (not WSL1)
# Check Docker is running (not just installed)
# Check Docker can pull and run a test container
# Check NVIDIA GPU is visible inside WSL2 (nvidia-smi)
# Check GPU VRAM >= 14GB (for qwen2.5-coder:14b)
# Check Ollama is reachable at localhost:11434 (or install it)
# Check PostgreSQL port 5432 is not already in use
# Check Redis port 6379 is not already in use
# Check Temporal port 7233 is not already in use
# Check Jaeger port 16686 is not already in use

# Output: gate1-report.json with pass/fail per check
# Exit code 0 = all pass, Exit code 1 = failures found
# Print upgrade instructions for any failing check
```

**If Gate 1 fails on any check, stop. Print exact upgrade commands. Do not proceed.**

---

## GATE 2 — DEPENDENCY RESOLUTION

Before writing implementation code, generate all dependency files and resolve them:

1. Generate `package.json` for every TypeScript package with exact version ranges
2. Run `pnpm install` and verify lock file is generated with no unresolved peer deps
3. Generate `requirements.txt` (or `pyproject.toml`) for every Python package
4. Run `uv pip install` and verify all packages resolve without conflicts
5. Generate `docker-compose.yml` with all service images pinned to exact tags
6. Run `docker compose pull` to verify all images are downloadable
7. Output: `gate2-report.json` with dependency tree and any conflicts

**If any dependency conflict exists, resolve it before writing implementation code.**

---

## GATE 3 — INFRASTRUCTURE HEALTH

Generate `docker-compose.yml` with the following services and health checks:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    # health check: pg_isready -U rsf_user -d rsf_db
    # Must reach HEALTHY before any other service starts

  redis:
    image: redis:7.2-alpine
    # health check: redis-cli ping
    
  temporal:
    image: temporalio/auto-setup:1.24
    # health check: temporal operator cluster health
    depends_on: [postgres]
    
  temporal-ui:
    image: temporalio/ui:latest
    # Temporal workflow visualization at localhost:8080
    
  jaeger:
    image: jaegertracing/all-in-one:1.58
    # Distributed tracing UI at localhost:16686
    
  ollama:
    image: ollama/ollama:latest
    # GPU passthrough required for WSL2
    # health check: curl localhost:11434/api/tags
    # Post-start: pull qwen2.5-coder:14b, llama3.3:8b, nomic-embed-text
```

Run `docker compose up -d` and wait for all health checks to pass.
`scripts/gate3-infra-health.sh` polls every service until HEALTHY or timeout (5 minutes).
**If any service fails to reach HEALTHY within timeout, print diagnostic output and stop.**

---

## GATE 4 — CONTRACT TESTS

Before writing any agent logic, write and pass these cross-layer contract tests:

```
Contract 1: TypeScript → PostgreSQL
  - Can connect using env vars (not hardcoded credentials)
  - Can create a table, insert a row, query it, delete it
  - pgvector extension is loaded (SELECT * FROM pg_extension WHERE extname = 'vector')
  - Can store and query a 1536-dimension vector

Contract 2: TypeScript → Redis
  - Can SET and GET a key
  - TTL expiry works correctly
  - Can LPUSH and LPOP (for queue patterns)

Contract 3: TypeScript → Ollama
  - Can reach localhost:11434
  - qwen2.5-coder:14b model is available
  - Can complete a simple prompt and receive a response
  - Response time < 30s for a 100-token completion

Contract 4: TypeScript → Anthropic Claude API
  - API key is loaded from environment (never hardcoded)
  - Can make a test call to claude-haiku-3-5
  - Receives a valid response
  - Error handling works for rate limit and auth failure

Contract 5: TypeScript → Temporal
  - Can connect to Temporal server at localhost:7233
  - Can register a simple workflow
  - Can start the workflow and wait for completion

Contract 6: TypeScript → Audit Log
  - Can write a structured JSON event to /logs/audit.jsonl
  - Can write the same event to PostgreSQL agent_events table
  - Both writes succeed atomically (if one fails, both are rolled back)

Contract 7: Python → Ollama
  - Python Ollama SDK can reach the same local server
  - Can generate embeddings using nomic-embed-text

Contract 8: Python → Anthropic API
  - Python Anthropic SDK reads key from environment
  - Can make a test call successfully
```

All 8 contracts must pass before proceeding to Layer 2 implementation.

---

## GATE 5 — PHASE COMPLETION VALIDATION

At the end of each phase, run the full test suite. Phase does not complete until:
- All unit tests pass (0 failures)
- All contract tests pass (0 failures)
- All integration tests pass (0 failures)
- Audit log correctly captured all actions taken during the test run
- Kill switch is tested and works (sends SIGTERM to all agent processes)
- No `.env` values appear anywhere in the codebase (run a grep scan)
- No hardcoded localhost ports appear outside of config files
- TypeScript compiles with zero errors (`tsc --noEmit`)
- Python passes type checking (`mypy` with strict mode)

---

## DATABASE SCHEMA

Generate these tables as Flyway migrations. Every migration file is numbered `V{n}__{description}.sql`.

```sql
-- V1__initial_schema.sql

-- Event sourcing: append-only, never update or delete
CREATE TABLE agent_events (
    id              BIGSERIAL PRIMARY KEY,
    event_id        UUID NOT NULL DEFAULT gen_random_uuid(),
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    agent_id        VARCHAR(255) NOT NULL,
    agent_type      VARCHAR(100) NOT NULL,
    action_type     VARCHAR(100) NOT NULL,
    phase           VARCHAR(50),
    session_id      UUID,
    inputs          JSONB,
    outputs         JSONB,
    model_used      VARCHAR(100),
    tokens_in       INTEGER,
    tokens_out      INTEGER,
    cost_usd        NUMERIC(10, 6),
    duration_ms     INTEGER,
    status          VARCHAR(50) NOT NULL, -- SUCCESS | FAILURE | KILLED | TIMEOUT
    error_message   TEXT,
    parent_event_id UUID
);

-- Vector memory for semantic search
CREATE TABLE memory_entries (
    id          BIGSERIAL PRIMARY KEY,
    entry_id    UUID NOT NULL DEFAULT gen_random_uuid(),
    agent_id    VARCHAR(255),
    session_id  UUID,
    content     TEXT NOT NULL,
    embedding   vector(768),   -- nomic-embed-text produces 768-dim
    memory_type VARCHAR(50),   -- EPISODIC | SEMANTIC | PROCEDURAL
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accessed_at TIMESTAMPTZ,
    importance  FLOAT DEFAULT 0.5,
    metadata    JSONB
);

-- Generated artifacts (code, specs, blueprints, skills, MCP servers)
CREATE TABLE artifacts (
    id              BIGSERIAL PRIMARY KEY,
    artifact_id     UUID NOT NULL DEFAULT gen_random_uuid(),
    artifact_type   VARCHAR(100) NOT NULL, -- CODE | SPEC | BLUEPRINT | SKILL | MCP_SERVER | PROMPT | TEST
    name            VARCHAR(500) NOT NULL,
    version         INTEGER NOT NULL DEFAULT 1,
    content         TEXT NOT NULL,
    language        VARCHAR(50),
    quality_score   FLOAT,
    test_pass_rate  FLOAT,
    parent_id       UUID,   -- lineage tracking
    created_by      VARCHAR(255), -- which agent created it
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB
);

-- Agent blueprints (self-provisioning)
CREATE TABLE agent_blueprints (
    id              BIGSERIAL PRIMARY KEY,
    blueprint_id    UUID NOT NULL DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    version         INTEGER NOT NULL DEFAULT 1,
    system_prompt   TEXT NOT NULL,
    tools           JSONB,
    memory_config   JSONB,
    eval_criteria   JSONB,
    benchmark_score FLOAT,
    generation      INTEGER NOT NULL DEFAULT 1,
    parent_id       UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active       BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX ON agent_events (agent_id, timestamp);
CREATE INDEX ON agent_events (session_id);
CREATE INDEX ON agent_events (status);
CREATE INDEX ON memory_entries USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
CREATE INDEX ON artifacts (artifact_type, created_at);
CREATE INDEX ON agent_blueprints (generation, benchmark_score);
```

---

## KILL SWITCH IMPLEMENTATION

This must be the first functional feature built in Layer 2, before any agent runs.

```typescript
// packages/orchestration/src/kill-switch/index.ts

// Three kill switch mechanisms — all must work independently:

// 1. HTTP endpoint: POST /governance/stop
//    - Sets KILL_FLAG = true in Redis (key: 'rsf:kill:global', value: '1', no TTL)
//    - All agent loops check Redis for this flag before each iteration
//    - Returns 200 with count of agents notified

// 2. Environment variable: FOUNDRY_KILL=1
//    - All agent loops check process.env.FOUNDRY_KILL before each iteration

// 3. Shell signal: SIGTERM / SIGINT
//    - Graceful shutdown: finish current LLM call, write audit log entry, exit
//    - scripts/kill-switch.sh sends SIGTERM to all rsf-* processes

// Kill switch audit requirements:
//    - Every kill event MUST be logged to agent_events with action_type = 'KILL_SWITCH_ACTIVATED'
//    - Must record: who triggered it, how (HTTP/ENV/SIGNAL), timestamp, agents that were running
//    - Kill events are immutable — cannot be deleted from audit log
```

---

## AUDIT LOG SPECIFICATION

Every entry in `audit.jsonl` and `agent_events` table must include:

```json
{
  "event_id": "uuid-v4",
  "timestamp": "2025-03-22T10:30:00.000Z",
  "agent_id": "manufacturing-agent-001",
  "agent_type": "CODE_GENERATOR",
  "action_type": "LLM_CALL | TOOL_CALL | CODE_EXECUTE | TEST_RUN | DECISION | KILL_SWITCH | ERROR",
  "phase": "LAYER_3_MANUFACTURING",
  "session_id": "uuid-v4",
  "inputs": { "truncated to 10KB max": "..." },
  "outputs": { "truncated to 10KB max": "..." },
  "model_used": "claude-sonnet-4-6 | qwen2.5-coder:14b | null",
  "tokens_in": 1250,
  "tokens_out": 890,
  "cost_usd": 0.001234,
  "duration_ms": 4200,
  "status": "SUCCESS | FAILURE | KILLED | TIMEOUT",
  "error_message": null,
  "parent_event_id": "uuid-v4-of-parent-action"
}
```

---

## MODEL ROUTER SPECIFICATION

Classify every task before dispatching to an LLM. Never bypass the router.

```typescript
type TaskComplexity = 'TRIVIAL' | 'STANDARD' | 'COMPLEX' | 'CRITICAL';

// TRIVIAL → Ollama llama3.3:8b (local, free)
//   Examples: formatting, JSON extraction, simple classification, routing decisions
//   Max tokens: 512 output

// STANDARD → Ollama qwen2.5-coder:14b (local, free)
//   Examples: single-function code generation, test writing, documentation
//   Max tokens: 2048 output

// COMPLEX → Claude Haiku 3.5 (cloud, ~$0.001/call)
//   Examples: multi-file code generation, debugging, integration logic
//   Max tokens: 8192 output

// CRITICAL → Claude Sonnet 4.6 (cloud, ~$0.015/call)
//   Examples: architecture decisions, self-improvement proposals, security review,
//             formal spec generation, agent blueprint design, anything touching
//             the foundry's own infrastructure
//   Max tokens: 32768 output

// Budget guardrail: track daily spend in Redis
// If daily cloud spend exceeds $10 (configurable via env), escalate to CRITICAL-only mode
// If daily cloud spend exceeds $20, pause all cloud calls and notify via audit log
```

---

## AGENT BEHAVIORAL CONTRACTS

Every agent must be defined with a behavioral contract before implementation:

```typescript
interface AgentContract {
  agentId: string;
  preconditions: string[];      // Must be true before agent runs
  postconditions: string[];     // Must be true after agent completes successfully
  invariants: string[];         // Must be true throughout execution
  maxExecutionMs: number;       // Hard timeout
  maxTokensPerCall: number;     // Hard token limit
  allowedTools: string[];       // Whitelist — agent cannot call tools not listed
  allowedModels: string[];      // Whitelist — agent cannot call models not listed
  requiresApproval: boolean;    // If true, pause and wait for human approval before executing
  auditLevel: 'FULL' | 'SUMMARY'; // FULL logs inputs/outputs; SUMMARY logs only metadata
}
```

---

## SELF-PROVISIONING PIPELINE (Layer 5)

Implement in this exact order — each depends on the previous:

**Step 1: Prompt Optimizer**
- Integrate DSPy MIPROv2 (Python)
- Input: a prompt + a scoring function + example inputs/outputs
- Output: optimized prompt with measurable score improvement
- Validation: optimized prompt must score ≥ original prompt on held-out examples

**Step 2: Agent Blueprint Generator**
- Input: a natural language description of desired agent behavior
- Output: a complete `AgentContract` + Mastra agent definition + test suite
- Validation: generated agent must pass its own contract tests

**Step 3: Tool Synthesizer**
- Input: description of desired tool capability + optional API docs or OpenAPI spec
- Output: TypeScript tool function + Zod input schema + unit tests
- Validation: tool must pass all generated tests before registration

**Step 4: MCP Server Generator**
- Input: OpenAPI spec URL or path
- Output: complete TypeScript MCP server using `@modelcontextprotocol/sdk`
- Validation: generated MCP server must pass contract tests against the original API

**Step 5: Skill Authoring Agent**
- Input: a gap detection scan (what tasks repeatedly fail or require CRITICAL model calls that could be STANDARD)
- Output: complete `SKILL.md` file in `/skills/` directory
- Validation: skill must demonstrably reduce task failure rate or model tier used

---

## META-IMPROVEMENT LOOP (Layer 6)

The self-improvement cycle. Run on demand, not continuously.

```
Cycle trigger: Manual (human runs `pnpm run improve`) OR
               Automated (after N artifacts generated, run improvement cycle)

Step 1: MEASURE current factory quality
  - Run full test suite, record pass rates
  - Sample 10 recent artifacts, score them with multi-model consensus
  - Record current benchmark scores in agent_blueprints table

Step 2: PROPOSE improvements (Claude Sonnet 4.6)
  - Review agent_events for recurring failures
  - Review artifacts with quality_score < 0.7
  - Propose specific modifications to prompts, agent configs, or workflows

Step 3: TEST proposals in isolation
  - Apply proposed change to a clone of the affected component
  - Run component test suite against cloned version
  - Compare quality scores: proposed vs. current

Step 4: GATE — improvement must be measurable
  - If proposed version scores ≤ current version: discard, log, continue
  - If proposed version scores > current version: proceed to Step 5
  - Multi-model consensus: Claude Sonnet + local model must both agree it is better

Step 5: APPLY improvement
  - Increment version number on affected component
  - Write lineage record to artifacts table (parent_id links to previous version)
  - Run full test suite one more time
  - If regression detected: rollback, log, mark as failed improvement

Step 6: RECORD
  - Log improvement cycle results to agent_events
  - Update agent_blueprints.generation counter
  - Record what changed, why, and measured impact
```

**NEVER let the meta-improvement loop modify:**
- The kill switch
- The audit log writer
- The secret manager
- Gate 1 through Gate 5 scripts
- The model router's budget guardrails

These components require human review before modification.

---

## WHAT NOT TO BUILD IN V1

Do not build these until explicitly instructed. Scope creep will prevent V1 from completing in a few weeks.

- **No Neo4j / knowledge graph** — pgvector is sufficient
- **No cloud deployment** — Docker local only
- **No formal verification (Lean 4)** — reserved for Phase 5
- **No blockchain / distributed ledger** — deferred to future security phases
- **No neural network weight inspection or packet interception** — deferred security roadmap
- **No multi-tenant architecture** — single user, single machine
- **No C# / .NET components** — reserved for future enterprise integrations
- **No web UI** — CLI and REST API only in V1
- **No fine-tuning of models** — inference only
- **No external internet access from within agent sandboxes** — sandboxes are network-isolated

---

## SECURITY ARCHITECTURE (V1)

**Secret Management**
- All secrets in `.env` file, loaded via `dotenv-vault`
- `.env` in `.gitignore` — verified by Gate 5 grep scan
- `.env.example` committed with placeholder values documenting every required variable
- Required env vars: `ANTHROPIC_API_KEY`, `POSTGRES_URL`, `REDIS_URL`, `TEMPORAL_ADDRESS`, `FOUNDRY_KILL`, `MAX_DAILY_CLOUD_SPEND_USD`

**Sandbox Isolation**
- All generated code executes in Docker containers with:
  - No network access (--network none)
  - Read-only filesystem except /tmp
  - Memory limit: 2GB
  - CPU limit: 4 cores
  - Execution timeout: 60 seconds
  - User: non-root (uid 1000)

**Input Validation**
- All external inputs validated with Zod schemas before processing
- All LLM outputs parsed with Zod schemas — never `eval()` or dynamic `require()` on LLM output
- Prompt injection defense: separate system prompt from user content, never concatenate directly

**Audit Requirements**
- Every agent action logged (see Audit Log Specification above)
- Logs are append-only — no delete or update operations on audit tables
- Daily log rotation with compression — keep 90 days locally

---

## BUILD PHASES

### Phase 0 — Environment & Infrastructure (Days 1–3)
1. Run Gate 1 (environment audit), fix all failures
2. Generate all dependency files, run Gate 2
3. Build `docker-compose.yml`, run Gate 3
4. Write and pass all 8 contract tests (Gate 4)
5. Write Gate 5 validation script
6. **Deliverable:** All 5 gates pass. Infrastructure is healthy. Contracts are verified.

### Phase 1 — Foundation Layer (Days 4–7)
1. Implement secret manager (dotenv-vault integration)
2. Implement PostgreSQL client + Flyway migrations
3. Implement Redis client
4. Implement OpenTelemetry + Pino audit logger
5. Implement Docker sandbox executor
6. **Deliverable:** All Layer 1 unit tests pass. Audit log works. Secrets never in code.

### Phase 2 — Orchestration Layer (Days 8–12)
1. Implement kill switch (all 3 mechanisms)
2. Implement model router with difficulty classification
3. Implement agent behavioral contracts runtime
4. Implement first Mastra agent (specification interpreter)
5. Implement first Temporal workflow (durable task execution)
6. **Deliverable:** Kill switch tested and working. First agent runs end-to-end with full audit trail.

### Phase 3 — Manufacturing Layer (Days 13–18)
1. Implement spec interpreter (natural language → structured generation target)
2. Implement code generation engine with AST validation
3. Implement test-first generation (tests written before implementation)
4. Implement program repair agent
5. **Deliverable:** Foundry can generate a simple TypeScript module from a spec, with tests, validated by AST.

### Phase 4 — Quality Layer (Days 19–24)
1. Implement metamorphic test generator
2. Implement differential testing (N-version comparison)
3. Implement multi-model consensus gate
4. Implement property-based test generator (fast-check + Hypothesis)
5. **Deliverable:** Every generated artifact passes quality gates before acceptance.

### Phase 5 — Self-Provisioning Layer (Days 25–30)
1. Implement prompt optimizer (DSPy MIPROv2)
2. Implement agent blueprint generator
3. Implement tool synthesizer
4. Implement MCP server generator
5. **Deliverable:** Foundry can generate a new MCP server from an OpenAPI spec and a new agent from a description.

### Phase 6 — Meta-Improvement Layer (Days 31–35)
1. Implement improvement cycle (measure → propose → test → gate → apply → record)
2. Implement quality-diversity archive
3. Implement regression budget manager
4. **Deliverable:** Foundry completes one full self-improvement cycle with measurable quality delta.

### Phase 7 — Governance Layer (Days 36–40)
1. Implement REST API for governance operations
2. Implement audit log viewer (CLI-based in V1)
3. Implement configuration management
4. **Deliverable:** Operator can view all agent activity, adjust budgets, and trigger improvement cycles via API.

---

## STARTING INSTRUCTIONS FOR EACH SESSION

At the start of every Claude Code session on this project:

1. Read this entire CLAUDE.md file
2. Run `cat logs/audit.jsonl | tail -20` to see the last 20 actions taken
3. Run `docker compose ps` to verify infrastructure health
4. Ask: "Which phase are we currently in, and what is the next uncompleted task?"
5. Do not begin work until the user confirms the current phase and task
6. Do not assume the environment is in the same state as the previous session

---

## COMPATIBILITY NOTES FOR WSL2 + WINDOWS 11

These are known issues to handle proactively:

- **GPU passthrough:** Ollama on WSL2 requires the NVIDIA CUDA driver for WSL2 (not the standard Linux driver). Check with `nvidia-smi` inside WSL2. If it fails, print the exact driver installation command.
- **Docker Desktop WSL2 integration:** Must be enabled in Docker Desktop Settings → Resources → WSL Integration. Verify with `docker ps` inside WSL2.
- **Port conflicts:** Windows can bind ports that appear available in WSL2. Always check with `netstat -ano | findstr :5432` in Windows PowerShell before starting Docker services.
- **File permissions:** Files created in WSL2 may have wrong permissions when accessed from Windows. Use `/home/{user}/` paths inside WSL2, not `/mnt/c/` paths, for all project files.
- **Line endings:** Configure Git with `git config core.autocrlf false` inside WSL2 to prevent CRLF issues in shell scripts.
- **pnpm store:** Configure pnpm store inside WSL2 filesystem: `pnpm config set store-dir ~/.pnpm-store`

---

## FUTURE SECURITY ROADMAP (Post-V1, Do Not Build Now)

Document these for future phases. Do not implement in V1.

- **Policy engine:** Open Policy Agent (OPA) for fine-grained authorization of agent actions
- **Network security:** Zero-trust networking between services, mutual TLS, service mesh (Istio or Linkerd)
- **Behavioral observer models:** Frozen-weight LLMs running in parallel that analyze other agents' outputs for anomalous patterns — do not share context or memory with production agents
- **Packet analysis:** Network traffic inspection for agent communication (requires Linux kernel capabilities, design for WSL2 limitations)
- **Supply chain security:** AI-BOM (AI Bill of Materials) for all generated artifacts, tracking provenance from spec to deployed code
- **Watermarking:** Cryptographic watermarks in all AI-generated code for provenance verification

---

*This specification was generated from validated research covering the period March 2025 – March 2026, incorporating findings from Darwin Gödel Machine (Sakana AI), Agent Behavioral Contracts framework (arXiv:2602.22302), ADAS automated agent design (ICLR 2025), information-theoretic self-improvement bounds (arXiv:2601.05280), and production deployments at Klarna, Replit, and Temporal.*
