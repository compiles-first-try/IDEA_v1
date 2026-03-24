# RSF DESKTOP UI — CLAUDE CODE BUILD SPECIFICATION
## Version: 1.3.0 | Package: apps/desktop | Status: V1 Build

---

## CRITICAL OPERATING RULES — READ BEFORE ANYTHING ELSE

1. NEVER assume anything. If a requirement is ambiguous, stop and ask before proceeding.
2. NEVER hardcode secrets, API endpoints, or tokens. All config goes through environment variables or Tauri's secure store.
3. NEVER skip a compatibility gate. UI gates 1–5 must pass before proceeding to the next phase.
4. NEVER write implementation code before writing its tests. Tests first, always.
5. ALWAYS write TypeScript with strict mode. No `any` types without explicit justification.
6. ALWAYS use the existing governance REST API for all data operations. The UI is a consumer — it never writes directly to the database.
7. The kill switch button must be implemented and tested before any other agent-facing UI feature.
8. Surface non-obvious problems proactively. If you see a design conflict or missing requirement, flag it before proceeding.
9. Gate scripts must verify their own detection logic against at least one known-installed package before being considered valid. If a gate reports a failure, check whether the detection method itself is correct before asking the user to reinstall anything.
10. jsdom does not implement scroll APIs — guard all scrollIntoView calls with typeof checks. Pattern established in AuditStream component (UI Gate 4).
11. NEVER use SELECT * in any database query — always name columns explicitly. This is a CDC-readiness rule that ensures schema changes only break components that use changed columns.
12. All governance API responses consumed by the UI MUST check for a schema_version field. If schema_version does not match the expected version, show a warning banner: "Backend schema has been updated. Some features may behave unexpectedly until the UI is rebuilt."
13. Every schema change (Flyway migration) that affects governance API responses MUST trigger a review of the PROJECT CONTEXT endpoint list and any API type definitions in the UI codebase. Schema drift between backend and frontend is a CDC-readiness violation.
14. Every spec file modification MUST include a version bump in the file header. After committing spec changes, tag the commit with `git tag spec-v{VERSION}`. The spec integrity gate validates that the in-file version matches the latest git tag.
15. The apps/desktop/tsconfig.json MUST contain `"ignoreDeprecations": "6.0"` in compilerOptions. This is required because the Windows-side Tauri build uses TypeScript 7.x (global install) while WSL2 uses TypeScript 5.5. The flag is harmless in TS 5.5 but breaks the Windows build without it. Do NOT remove this line.

---

## PROJECT CONTEXT

This UI is the control surface for the Recursive Software Foundry (RSF) — a self-improving, self-healing software manufacturing platform already built and running at `~/Projects/IDEA_v1`.

The foundry has a working governance REST API at `http://localhost:3000` (Express + Zod) with these endpoints:
- `GET /health` — infrastructure health
- `POST /governance/stop` — kill switch
- `GET /governance/audit` — audit log events
- `GET /governance/status` — active agents, daily spend, current phase
- `POST /governance/improve` — trigger self-improvement cycle
- `GET /governance/config` — current configuration
- `PATCH /governance/config` — update configuration
- `GET /governance/artifacts` — paginated artifact list
- `GET /governance/agents` — agent blueprints
- `POST /governance/feedback/validate` — submit feedback for validation (does NOT write to DB)
- `POST /governance/feedback/confirm` — confirm feedback after validation
- `POST /governance/docs/ingest` — ingest document into knowledge base
- `GET /governance/docs` — list ingested documents
- `POST /governance/models/pull` — pull Ollama model (SSE progress)
- `GET /governance/models` — list available models
- `ws://localhost:3000/audit-stream` — real-time audit event WebSocket

The UI connects to this API. It does not bypass it.

---

## TECHNOLOGY STACK — EXACT VERSIONS

### Desktop Shell
- **Tauri v2** (`^2.0.0`) — cross-platform desktop shell (Windows, macOS, Linux)
  - Rust backend handles OS integration only (file dialogs, system tray, window management)
  - All business logic stays in the existing Node.js governance API
  - Tauri communicates with the governance API via HTTP/WebSocket from the frontend

### Frontend (inside Tauri)
- **React 19** + **TypeScript 5.5+** — component layer
- **Vite 6** — build tool (Tauri's default bundler)
- **Tailwind CSS v4** — styling
- **TanStack Query v5** — API state management, caching, background refetch
- **Zustand v5** — local UI state (theme, layout, selected items)
- **Recharts v2** — spend charts, quality score trends, token usage graphs
- **Xterm.js v5** — live streaming audit log terminal view
- **Monaco Editor v0.50** — spec input textarea and generated code viewer (VS Code's editor)
- **Lucide React** — icons
- **clsx + tailwind-merge** — conditional class utilities

### Communication
- **WebSocket** — real-time audit event streaming from governance API
- **TanStack Query** — polling for status/health (every 5 seconds)
- **Axios** — REST API calls

### Testing
- **Vitest** + **React Testing Library** — component tests
- **Playwright** — end-to-end desktop app tests (Tauri supports Playwright via WebDriver)

---

## PROJECT STRUCTURE

Add this to the existing `~/Projects/IDEA_v1` workspace:

```
IDEA_v1/
├── apps/
│   └── desktop/                          # New — Tauri desktop app
│       ├── src-tauri/                    # Rust Tauri shell (minimal)
│       │   ├── src/
│       │   │   ├── main.rs
│       │   │   └── lib.rs
│       │   ├── Cargo.toml
│       │   ├── tauri.conf.json
│       │   └── icons/                   # App icons (all sizes)
│       ├── src/                         # React frontend
│       │   ├── main.tsx                 # Entry point
│       │   ├── App.tsx                  # Root layout + theme provider
│       │   ├── components/
│       │   │   ├── layout/
│       │   │   │   ├── Sidebar.tsx      # Navigation sidebar
│       │   │   │   ├── TopBar.tsx       # Status bar + kill switch
│       │   │   │   └── MainPanel.tsx    # Content area
│       │   │   ├── build/
│       │   │   │   ├── SpecInput.tsx    # Monaco editor for spec entry
│       │   │   │   ├── PipelineView.tsx # Live pipeline stage visualization
│       │   │   │   └── ArtifactView.tsx # Generated code / test viewer
│       │   │   ├── audit/
│       │   │   │   ├── AuditStream.tsx  # Xterm.js live audit log
│       │   │   │   └── AuditTable.tsx   # Filterable audit event table
│       │   │   ├── agents/
│       │   │   │   ├── AgentCard.tsx    # Agent profile with skills.md
│       │   │   │   └── AgentRoster.tsx  # All active agents
│       │   │   ├── governance/
│       │   │   │   ├── KillSwitch.tsx   # Big red button — always visible
│       │   │   │   ├── ConfigPanel.tsx  # Spend limits, model tiers
│       │   │   │   └── StatusPanel.tsx  # Health, spend, phase
│       │   │   ├── inference/
│       │   │   │   ├── ModelManager.tsx # Add/remove LLM providers
│       │   │   │   └── RouterView.tsx   # Live routing decisions
│       │   │   ├── improvement/
│       │   │   │   ├── ImproveCycle.tsx # Trigger + monitor improvement
│       │   │   │   └── QualityArchive.tsx # Historical quality scores
│       │   │   ├── knowledge/
│       │   │   │   ├── DocIngestion.tsx # Upload/tag documentation
│       │   │   │   └── KnowledgeBase.tsx # Browse ingested docs
│       │   │   ├── feedback/
│       │   │   │   └── FeedbackPanel.tsx # Manual feedback on artifacts
│       │   │   └── shared/
│       │   │       ├── ThemeToggle.tsx
│       │   │       ├── LayoutToggle.tsx
│       │   │       ├── StatusBadge.tsx
│       │   │       └── CodeBlock.tsx
│       │   ├── hooks/
│       │   │   ├── useFoundryStatus.ts  # Polling hook for /governance/status
│       │   │   ├── useAuditStream.ts    # WebSocket hook for live audit
│       │   │   ├── useKillSwitch.ts     # Kill switch with confirmation
│       │   │   └── useConfig.ts         # Config read/write
│       │   ├── api/
│       │   │   ├── client.ts            # Axios instance with base URL
│       │   │   ├── governance.ts        # Typed API calls
│       │   │   ├── audit.ts
│       │   │   ├── artifacts.ts
│       │   │   └── agents.ts
│       │   ├── store/
│       │   │   ├── theme.ts             # Zustand: dark/light/system
│       │   │   ├── layout.ts            # Zustand: sidebar, panels
│       │   │   └── session.ts           # Zustand: active build session
│       │   ├── types/
│       │   │   ├── api.ts               # Zod schemas matching governance API
│       │   │   └── ui.ts                # UI-only types
│       │   └── styles/
│       │       └── globals.css          # Tailwind base + CSS variables
│       ├── tests/
│       │   ├── components/              # Vitest + RTL
│       │   └── e2e/                     # Playwright
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── tailwind.config.ts
└── pnpm-workspace.yaml                  # Add apps/desktop to workspace
```

---

## UI GATE 1 — TOOLCHAIN AUDIT

Before writing any UI code, verify these tools are available inside WSL2:

```bash
# Check Rust toolchain (required for Tauri)
rustc --version          # need >= 1.77.0
cargo --version

# Check system dependencies for Tauri on Linux/WSL2
pkg-config --version
# webkit2gtk-4.1 must be installed:
dpkg -l | grep libwebkit2gtk

# Check Node toolchain
node --version           # need >= 22
pnpm --version           # need >= 9

# Check VS Code has Tauri extension (optional but helpful)
code --list-extensions | grep tauri
```

If Rust is not installed:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

If webkit2gtk is missing (required for Tauri on Linux):
```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev \
  librsvg2-dev patchelf libssl-dev libgtk-3-dev
```

Output a `ui-gate1-report.json` with pass/fail per check.
Exit code 0 = all pass. Print exact fix commands for failures.
DO NOT PROCEED until all checks pass.

---

## UI GATE 2 — DEPENDENCY RESOLUTION

1. Scaffold the Tauri v2 app: `pnpm create tauri-app apps/desktop --template react-ts`
2. Add all frontend dependencies to `apps/desktop/package.json`
3. Run `pnpm install` from workspace root — verify lock file resolves cleanly
4. Verify TypeScript compiles with 0 errors: `tsc --noEmit`
5. Verify Vite dev server starts without errors
6. Output `ui-gate2-report.json`

DO NOT PROCEED until pnpm install resolves with 0 peer dep errors.

---

## UI GATE 3 — GOVERNANCE API CONNECTIVITY

The UI must be able to reach the governance API before any component is built.

Write and run these connectivity tests:

```typescript
// tests/api-connectivity.test.ts

// Test 1: GET /health returns 200
// Test 2: GET /governance/status returns valid shape (Zod validate)
// Test 3: GET /governance/audit returns array
// Test 4: GET /governance/config returns valid config shape
// Test 5: WebSocket connection to ws://localhost:3000/audit-stream
//         receives at least one message within 10 seconds
//         (may need to trigger an action to generate an event)
```

NOTE: The governance API may need a WebSocket endpoint added.
If `ws://localhost:3000/audit-stream` does not exist, add it to
`packages/governance/src/api/` before proceeding. It should emit
`agent_events` rows as they are inserted into PostgreSQL.

Output `ui-gate3-report.json`.
DO NOT PROCEED until all 5 connectivity tests pass.

---

## UI GATE 4 — COMPONENT CONTRACT TESTS

Before building complex UI, verify each major component renders without errors
and meets its contract:

```
Contract 1: KillSwitch renders a button, clicking shows confirmation dialog,
            confirming calls POST /governance/stop, cancelling does not.

Contract 2: StatusPanel renders health badges for all 6 Docker services
            using data from GET /health.

Contract 3: SpecInput renders a Monaco editor, accepts text input,
            submit button is disabled when input is empty.

Contract 4: AuditStream renders an Xterm terminal, connects to WebSocket,
            displays incoming events as formatted lines.

Contract 5: ThemeToggle switches between dark/light/system modes,
            persists selection to Zustand store,
            applies correct Tailwind class to root element.

Contract 6: ConfigPanel loads current config from GET /governance/config,
            renders spend limit inputs, saving calls PATCH /governance/config
            with Zod-validated payload.
```

All 6 contracts must pass before building remaining components.

---

## UI GATE 5 — PHASE COMPLETION VALIDATION

At the end of each UI phase, run these checks. All must pass.

WSL2-side checks (run in every phase):
- All Vitest tests pass (0 failures)
- All component contracts pass
- TypeScript compiles with 0 errors
- No hardcoded API URLs (all from config)
- No hardcoded colors (all from theme tokens)
- Vite production build completes without errors: `pnpm vite build`
- Kill switch is visible and functional

Windows-side checks (run in UI Phase 6 packaging only):
- Tauri app builds without errors: `pnpm tauri build --debug` (run from Windows PowerShell)
- App launches on Windows and displays the shell correctly
- Kill switch is clickable and triggers confirmation modal

Note: Tauri cannot render a window inside WSL2 (no display server). The WSL2-side checks validate all logic and compilation. The Windows-side checks validate the native desktop shell and are deferred to Phase 6 packaging.

---

## VISUAL DESIGN SYSTEM

### Theme
Two modes: dark and light. Toggled by user, persisted to localStorage and Zustand.
System default on first launch.

Dark mode palette:
- Background primary: `#0f1117`
- Background secondary: `#1a1d27`
- Background elevated: `#242736`
- Border: `rgba(255,255,255,0.08)`
- Text primary: `#e8eaf0`
- Text secondary: `#8b909e`
- Accent blue: `#3b82f6`
- Accent green: `#22c55e`
- Accent amber: `#f59e0b`
- Accent red: `#ef4444`
- Accent purple: `#a78bfa`

Light mode palette:
- Background primary: `#ffffff`
- Background secondary: `#f4f5f7`
- Background elevated: `#ffffff`
- Border: `rgba(0,0,0,0.08)`
- Text primary: `#111827`
- Text secondary: `#6b7280`
- Accent blue: `#2563eb`
- Accent green: `#16a34a`
- Accent amber: `#d97706`
- Accent red: `#dc2626`
- Accent purple: `#7c3aed`

### Typography
- Font: System font stack — `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Monospace (code, audit log, spec input): `'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace`
- Sizes: 11px (micro), 12px (label), 13px (small), 14px (body), 16px (subheading), 20px (heading)
- Weight: 400 regular, 500 medium, 600 semibold only

### Spacing
4px base unit. Use multiples: 4, 8, 12, 16, 20, 24, 32, 40, 48px.

### Layout
Default: fixed left sidebar (220px) + top bar (48px) + main content area.
Sidebar collapses to icon-only mode (48px) via toggle.
Layout preference persisted to Zustand.

### Component Rules
- All interactive elements have hover and focus states
- Loading states use skeleton loaders (not spinners) for content areas
- Error states show inline with specific message — no modal popups for errors
- Confirmations (kill switch, improvement trigger) use modal dialog with explicit confirm text
- No tooltips on primary actions — labels are always visible
- Status indicators: green dot (healthy), amber dot (degraded), red dot (down), gray dot (unknown)

---

## LAYOUT — SIDEBAR NAVIGATION SECTIONS

```
┌──────────────────────────────────────────────────────────┐
│  TOP BAR                                                 │
│  [RSF]  Status: ● Running  Spend: $0.00/day  [■ STOP]   │
├──────────┬───────────────────────────────────────────────┤
│ SIDEBAR  │  MAIN CONTENT AREA                           │
│          │                                               │
│ ● Build  │  (changes based on sidebar selection)        │
│ ● Audit  │                                               │
│ ● Agents │                                               │
│ ● Models │                                               │
│ ● Improve│                                               │
│ ● Docs   │                                               │
│ ● Config │                                               │
│ ● Feedback│                                              │
│          │                                               │
│ ────     │                                               │
│ ◑ Theme  │                                               │
│ ⊞ Layout │                                               │
└──────────┴───────────────────────────────────────────────┘
```

---

## FEATURE SPECIFICATIONS BY SECTION

### TOP BAR (always visible, never hidden)

Components:
- App name/logo: "RSF" wordmark, small, left-aligned
- Status indicator: live dot + text from GET /governance/status (polls every 5s)
- Daily spend: `$X.XX / day` from status, colored green/amber/red based on % of limit
- Active agents count: `N agents` live
- KILL SWITCH: Red button `■ STOP`, always right-aligned, always visible
  - Single click opens confirmation modal
  - Modal text: "Stop all agent activity immediately? This cannot be undone."
  - Confirm button text: "Stop Everything"
  - Calls POST /governance/stop on confirm
  - Button disabled for 3 seconds after trigger to prevent double-fire
  - Audit log entry created on every trigger attempt (confirmed or cancelled)

---

### BUILD SECTION

The primary workflow screen. User submits a spec and watches the foundry work.

Left panel (40%): Spec input
- Monaco editor with TypeScript language hints disabled (plain text mode)
- Placeholder: "Describe the software you want to build..."
- Below editor: reasoning mode selector
  - Option A: Sequential (default) — standard pipeline
  - Option B: Feynman Mode — agent first simplifies the problem, identifies unknowns, retrieves relevant knowledge, then generates
  - Option C: Parallel DAG — topological task decomposition, parallel execution where dependencies allow
- Submit button: "Build" — disabled when editor is empty or foundry is busy

Right panel (60%): Pipeline visualization
- Shows each stage as it executes: Spec Interpreter → Router Decision → Code Generator → Test Generator → Quality Gates → Consensus
- Each stage shows: name, status (pending/running/passed/failed), model used, duration, tokens
- Stages animate in sequence as they complete
- Below pipeline: tabbed output viewer
  - Tab 1: Generated Code (Monaco editor, read-only, TypeScript syntax highlighting)
  - Tab 2: Generated Tests (Monaco editor, read-only)
  - Tab 3: Quality Gate Results (table: gate name, result, details)
  - Tab 4: Audit Trail (table: timestamp, agent, action, model, duration)

---

### AUDIT SECTION

Two views toggled by sub-tabs:

Live Stream tab:
- Xterm.js terminal, dark background always
- New events append in real time via WebSocket
- Each line formatted: `[HH:MM:SS] [AGENT_ID] [ACTION_TYPE] [STATUS] [Xms]`
- Color coded: green for SUCCESS, red for FAILURE, amber for TIMEOUT, blue for DECISION
- Auto-scrolls to bottom (toggle to pause auto-scroll)
- Clear button resets terminal display (does not delete database records)

History tab:
- Filterable table: filter by agent ID, action type, status, date range
- Columns: timestamp, agent, action, model used, tokens in/out, duration, status
- Click any row to expand full event detail (inputs, outputs, error message)
- Export button: download filtered results as CSV
- Pagination: 50 rows per page

---

### AGENTS SECTION

Three discovery surfaces for the agent registry. A flat card list breaks at 50+ agents. Three views serve different use cases — search for daily operations, org chart for architecture reviews, capability matrix for finding the right agent for a task.

**Data model for the Agent Registry**
Combines agent_blueprints with derived metadata:
- Capability tags: automatically extracted from each agent's tools list and system_prompt (e.g., code-generation, ast-validation, test-writing, MCP-generation)
- Role taxonomy (controlled vocabulary): PRODUCER (generates artifacts), VALIDATOR (quality gates), ORCHESTRATOR (coordinates others), PROVISIONER (builds tools), OBSERVER (monitoring/audit)
- Dependency graph: which agents call which others, derived from audit_log patterns
- Performance profile: success rate, avg duration, token efficiency, per agent
- Current status: ACTIVE, IDLE, DEGRADED, DEPRECATED

**Surface 1 — Semantic search (default view)**
- Text input: "Find agents that can validate TypeScript"
- Uses pgvector embedding search on agent system_prompts and capability tags
- Returns ranked results with relevance scores
- Each result shows: agent ID, role, top 3 capability tags, success rate, status badge
- Click to open full agent profile modal

**Surface 2 — Org chart view (topology tab)**
- Directed graph visualization using React Flow + Dagre layout
- Nodes = agents, edges = orchestration relationships derived from audit log
- Color-coded by role taxonomy (PRODUCER = blue, VALIDATOR = purple, ORCHESTRATOR = green, PROVISIONER = amber, OBSERVER = gray)
- Click node to open agent profile
- Most useful for stakeholder demos and architecture reviews
- Note: edges are derived from observed behavior in audit_log — not statically declared

**Surface 3 — Capability matrix (table tab)**
- Rows = agents, columns = capability tags
- Filter by role, capability tag, status, or model tier
- Sort by success rate, total runs, avg duration
- Most efficient view for finding a specific agent when you know the capability you need
- Export to CSV button

**Agent profile modal (shared across all three surfaces)**
For each agent:
- Agent ID, type, role, status badge
- Description (full system_prompt, collapsible)
- Skills: rendered SKILL.md if it exists, otherwise inferred tags
- Behavioral contract: preconditions, postconditions, invariants, allowed tools, allowed models, token limits
- Execution stats: total runs, success rate, avg duration, last active
- Lineage: parent blueprint ID and generation number
- Feedback button: opens feedback panel pre-filtered to this agent's artifacts

FUTURE PLACEHOLDER (V2): Agent creation wizard — "Define a new agent" button present but disabled with tooltip "Coming in V2 — Agent Blueprint Generator"

---

### MODELS SECTION

LLM provider and model management.

Current providers panel:
- Shows all configured inference providers
- For each provider: name, type (local/cloud), status (reachable/unreachable), models available
- Local Ollama section:
  - Lists installed models with size and last used
  - Pull new model: text input + "Pull" button (calls ollama pull via governance API)
  - Remove model button per model
- Anthropic API section:
  - Shows API key status (set/not set — never shows the key itself)
  - Lists available models (claude-sonnet-4-6, claude-haiku-3-5)
  - Test connection button

Model router visualization:
- Shows current routing rules: TRIVIAL → model, STANDARD → model, COMPLEX → model, CRITICAL → model
- Each tier shows: model name, estimated cost per call, calls today

Add provider button:
- Opens modal with provider type selector (Ollama, Anthropic, OpenAI, Groq, custom endpoint)
- Fields vary by type
- Test connection before saving
- Saves to governance config via PATCH /governance/config

FUTURE PLACEHOLDER (V3): Fine-tuning panel — "Train on System Data" button present but disabled with tooltip "Coming in V3 — requires sufficient training data volume"

---

### IMPROVE SECTION

Self-improvement cycle management.

Current quality metrics panel:
- Overall quality score trend (line chart, last 10 cycles)
- Per-component scores: Foundation, Orchestration, Manufacturing, Quality, Provisioning
- Regression budget remaining for this cycle (progress bar)
- Last improvement cycle: timestamp, what changed, delta score

Trigger panel:
- "Run Improvement Cycle" button
- Confirmation modal: "This will analyze all recent builds and propose improvements to agent configurations and prompts. Duration: 5–15 minutes."
- During run: progress view showing measure → propose → test → gate → apply steps
- After run: summary of what changed, what was rejected, quality delta

Quality archive:
- Table of all past agent configurations
- Columns: generation number, benchmark score, key changes, lineage (parent config)
- Click row to see full config diff against current version

Feedback integration:
- "Rated examples this cycle: N" — shows how many human feedback entries were incorporated
- Link to Feedback section

---

### DOCS SECTION

Knowledge base management.

Ingested documents panel:
- Table of all documents in the vector store
- Columns: name, type (API docs / system docs / domain knowledge), date ingested, chunk count, last retrieved
- Delete button per document

Ingest new document:
- Drag and drop area for files (PDF, Markdown, plain text, OpenAPI YAML/JSON)
- URL input: paste a URL to ingest a web page or API documentation endpoint
- Tags input: comma-separated tags for retrieval filtering
- After upload: shows processing status (chunking → embedding → stored)

Search knowledge base:
- Semantic search input
- Shows top 5 matching chunks with relevance scores

FUTURE PLACEHOLDER (V2): Ontology editor — structured knowledge graph visualization and editing

---

### CONFIG SECTION

Runtime configuration management.

Spend limits panel:
- Daily soft limit (amber warning): input in USD
- Daily hard limit (auto-pause): input in USD
- Per-call limit for CRITICAL tier: input in USD
- Save button: calls PATCH /governance/config with Zod validation

Model tier panel:
- Four rows: TRIVIAL, STANDARD, COMPLEX, CRITICAL
- Each row: current model (dropdown of available models), estimated cost
- Override button per tier

Autonomy settings panel:
- Autonomy level selector: SUPERVISED (human approval on each phase gate) / SEMI-AUTO (approval only on CRITICAL decisions) / FULL-AUTO (no approval required)
- Auto-trigger improvement cycles: toggle + frequency selector

Ethics constitution panel (TWO-TIER ARCHITECTURE — implement exactly as specified):

This panel is split into two visually distinct sections. The distinction is not cosmetic — it is a security boundary backed by empirical research. Anthropic's alignment faking study (Greenblatt et al., arXiv:2412.14093, December 2024) demonstrated that models trained against a modified constitution can develop resistance to retraining while appearing compliant. The ABC framework (Bhardwaj, arXiv:2602.22302, February 2026) establishes that hard constraints require 100% compliance with no exceptions.

TIER 1 — LOCKED CONSTITUTION (read-only, cannot be modified through UI):
- Visual treatment: dark background, lock icon on each principle, "System-enforced" label
- Source: hardcoded in the foundry codebase at packages/orchestration/src/contracts/locked-constitution.ts — NOT in the database
- Cannot be modified through the UI, through the API, or through the self-improvement loop
- The improvement loop's protected components list already blocks modification of this file
- Clicking a principle opens an info modal explaining what it does and WHY it is locked
- There is no unlock button. Changing a locked principle requires a code commit — creating an auditable record
- Example locked principles (render all of these):
  * "Never execute destructive operations (file deletion, database drops) without explicit human confirmation shown in the UI"
  * "Never modify the kill switch, audit log, locked constitution, or secret manager — ever"
  * "Never deceive the human operator about what the system is doing or has done"
  * "Never acquire capabilities, API access, or compute resources beyond the current sanctioned scope"
  * "Never disable or route around safety monitoring, behavioral contracts, or audit logging"
  * "Always present inference intent separately from execution — the operator must be able to see what an agent plans to do before it does it"

TIER 2 — CONFIGURABLE PRINCIPLES (editable, stored in database):
- Visual treatment: standard card style, edit icon per principle, "Operator-configured" label
- Stored in the governance config table
- Changes are written to the audit log with timestamp, old value, new value, and operator identity
- Edit opens an inline text editor per principle — not a full constitution editor
- Add principle button: adds a new configurable principle
- Delete button per principle (with confirmation)
- Reset to defaults button: restores the original set of configurable principles
- Example configurable principles (defaults):
  * "Prefer TypeScript over JavaScript for all generated code"
  * "Maximum file size for generated artifacts: 500 lines"
  * "Generated code must include JSDoc comments on all exported functions"

Note on terminology: the "corrigible vs inviolable" framing is a synthesis of Constitutional AI (Bai et al., 2022), the ABC hard/soft constraint distinction (Bhardwaj, 2026), and the alignment faking research implications. This two-tier architecture is the implementation of that synthesis — not a direct copy of any single paper's taxonomy.

PLACEHOLDERS (visible but disabled with "Coming in V2" tooltips):
- Policy Engine: "Define fine-grained agent action policies using OPA rules"
- Management Board: "Configure a strategic oversight board for agent alignment"
- Hallucination Detection: "Configure probability calibration and self-consistency checking"

---

### FEEDBACK SECTION

Manual feedback on generated artifacts — with a Feedback Validation Agent that prevents low-quality or biased feedback from corrupting the improvement loop.

**Why validation is required before feedback is accepted**
METR's "Recent Frontier Models Are Reward Hacking" (Von Arx, Chan, Barnes, June 2025) documented AI systems gaming evaluation metrics the moment those metrics become optimization targets — what decision theorists call Goodhart's Law. The same dynamic applies to human feedback: a fixed, unvalidated feedback signal will eventually be gamed or degraded by noise. RLTHF (Xu et al., arXiv:2502.13417, ICML 2025) demonstrated that full-annotation-level alignment can be achieved with only 6–7% of human annotation effort by focusing human effort specifically on the cases where automated signals are uncertain or conflicting — filtering rather than discarding. This is the pattern the Feedback Validation Agent implements.

**Architecture: Feedback Validation Agent**
Sits between the human rating and the improvement loop. Runs after every feedback submission. Never silently discards feedback — disputed feedback is stored in a feedback_disputes table with full explanation. The agent responds to the human with evidence, not judgment.

The agent cross-references the human rating against three independent signals:

Signal 1 — Automated test results. If a human rates an artifact as INCORRECT but the artifact passed all generated tests and differential testing showed unanimity with the reference implementation, the validation agent flags a conflict. Response to human: "This artifact passed 7/7 tests and matched the reference implementation on all test vectors. Which specific behavior do you believe is incorrect? Your clarification will be included with the feedback."

Signal 2 — Multi-model consensus history. If a human rates an artifact as EXCELLENT but the original consensus gate showed the evaluators disagreed during generation, the validation agent flags this for human confirmation. Response: "The two evaluators disagreed on this artifact during generation. Your positive rating is noted — please confirm it applies to the final output, not just the intent."

Signal 3 — Consistency with prior feedback. If a human's rating contradicts their own prior ratings on functionally identical artifacts (detected by cosine similarity of artifact embeddings), the validation agent flags the inconsistency neutrally. Response: "Your previous rating of a similar artifact was [X]. Has your evaluation criteria changed, or was that rating incorrect? Either answer is valid — this helps calibrate the improvement loop."

Outcomes:
- ACCEPTED: Rating passes all three signals. Written to artifacts.quality_score immediately.
- ACCEPTED WITH NOTE: Rating passes but one signal flagged — written to database with the agent's note attached.
- PENDING CLARIFICATION: Rating conflicts with one or more signals. Human is shown the evidence and asked to clarify. Not written to database until human responds or explicitly overrides.
- OVERRIDDEN: Human reviewed the evidence and explicitly confirmed their rating despite the conflict. Written to database with HUMAN_OVERRIDE flag and the evidence trail attached.

**UI components**

Recent artifacts panel:
- List of last 20 generated artifacts (code, tests, blueprints, MCP servers)
- Each shows: artifact type, name, creation timestamp, quality score (auto), user rating (if given), validation status badge

Rating interface:
- Thumbs up / thumbs down per artifact
- Optional text note: "What was wrong?" or "What worked well?"
- Tag selector: CORRECT / INCORRECT / PARTIAL / EXCELLENT
- Submit feedback: triggers Feedback Validation Agent — does NOT write directly to database

Validation response panel (appears after submission if validation flags something):
- Shows exactly which signal conflicted and the specific evidence
- Two response buttons: "Confirm my rating anyway" and "Update my rating"
- Neutral tone throughout — no accusatory language
- Dismiss button: defers the feedback without accepting or rejecting (stores as DEFERRED)

Feedback summary:
- Total submitted: N
- Accepted without conflict: N (X%)
- Accepted with note: N
- Pending clarification: N
- Overridden by human: N
- Common failure tags (bar chart)
- "This data will be used in the next improvement cycle" notice

**New governance API endpoint required**
```typescript
// POST /governance/feedback/validate
// Body: { artifact_id, rating, notes, tags }
// Runs Feedback Validation Agent — returns validation result with evidence
// Does NOT write to database yet

// POST /governance/feedback/confirm
// Body: { artifact_id, rating, notes, tags, validation_result, override_reason? }
// Writes to database after human has seen validation result
// Records full validation trail alongside the rating
```

---

## PHASE BUILD ORDER

### UI Phase 0 — Toolchain & Scaffold (Day 1–2)
1. Run UI Gate 1 (Rust + webkit2gtk + Tauri prerequisites)
2. Scaffold Tauri v2 app at `apps/desktop/`
3. Add all frontend dependencies, run UI Gate 2
4. Add WebSocket endpoint to governance API if missing
5. Run UI Gate 3 (API connectivity)
6. Run UI Gate 4 (component contracts)
Deliverable: Blank Tauri app launches, connects to governance API, all gates pass.

### UI Phase 1 — Shell & Navigation (Day 3–4)
1. Implement theme system (dark/light/system, Zustand persistence)
2. Implement layout system (sidebar, top bar, main panel, collapse)
3. Implement layout configurability (sidebar width, panel ratios, persisted)
4. Implement Top Bar with live status polling and KILL SWITCH
5. Implement all sidebar navigation routes (empty panels, correct routing)
6. Run UI Gate 5
Deliverable: Full app shell, theme toggle works, kill switch functional, navigation works.

### UI Phase 2 — Governance & Status (Day 5–6)
1. StatusPanel — all 6 Docker service health badges
2. ConfigPanel — spend limits, model tiers, autonomy, ethics constitution
3. AgentRoster — all agent cards with stats
4. ModelManager — Ollama + Anthropic provider management
Deliverable: Operator can see full system state and configure everything.

### UI Phase 3 — Build Workflow (Day 7–9)
1. SpecInput — Monaco editor with reasoning mode selector
2. PipelineView — live stage visualization with WebSocket
3. ArtifactView — Monaco code viewer, test viewer, quality gates table
4. Build session state management (Zustand)
Deliverable: User can submit a spec and watch the full pipeline run live.

### UI Phase 4 — Audit & History (Day 10–11)
1. AuditStream — Xterm.js live WebSocket terminal
2. AuditTable — filterable, paginated, expandable rows, CSV export
3. QualityArchive — improvement history with charts (Recharts)
Deliverable: Full audit visibility, historical browsing, export capability.

### UI Phase 5 — Knowledge, Feedback & Improvement (Day 12–14)
1. DocIngestion — file upload + URL ingest + processing status
2. KnowledgeBase — document table + semantic search
3. FeedbackPanel — artifact rating + notes + summary charts
4. ImproveCycle — trigger, progress view, results summary
Deliverable: Full self-improvement loop visible and controllable from UI.

### UI Phase 6 — Packaging & Distribution (Day 15–16)
1. Tauri build configuration for Windows (.msi + .exe), Linux (.deb + .AppImage)
2. App icons (all required sizes)
3. Auto-updater configuration (Tauri v2 built-in)
4. Installer smoke test on Windows (via WSL2 build)
5. README for installation on each platform
Deliverable: Installable app on Windows and Linux.

---

## GOVERNANCE API — ADDITIONS NEEDED

Before building the UI, add these to the existing governance API
(`packages/governance/src/api/`):

```typescript
// 1. WebSocket endpoint for live audit streaming
// ws://localhost:3000/audit-stream
// Emits agent_events rows as JSON as they are inserted into PostgreSQL
// Use pg LISTEN/NOTIFY pattern — governance API listens for new agent_events
// and broadcasts to all connected WebSocket clients

// 2. GET /governance/artifacts
// Returns paginated list of artifacts from the artifacts table
// Query params: type, limit, offset, sort (created_at desc default)

// 3. GET /governance/agents
// Returns all agent blueprints from agent_blueprints table

// 4. POST /governance/feedback
// Body: { artifact_id, rating, notes, tags }
// Updates artifacts table quality_score and adds feedback record

// 5. POST /governance/docs/ingest
// Body: { content, name, type, tags } or multipart form for file upload
// Chunks, embeds, and stores in memory_entries with memory_type = DOCUMENT

// 6. GET /governance/docs
// Returns all DOCUMENT type memory_entries

// 7. POST /governance/models/pull
// Body: { model_name }
// Calls ollama pull via shell command, streams progress back as SSE

// 8. GET /governance/models
// Returns list of available Ollama models + Anthropic API status
```

Write tests for all new endpoints before implementation.
All endpoints must use Zod validation.
All endpoints must write to audit log.

---

## FEATURE NOTES FOR FUTURE PHASES

Document these in a `ROADMAP.md` at the root of `apps/desktop/`:

### V2 Features (next major version)
- Policy engine (OPA integration) — fine-grained agent action authorization
- Management board — strategic oversight layer for agent alignment, visible to human but not modifiable by agents
- Hallucination detection panel — semantic entropy scoring, self-consistency checking
- Karpathy Loop / context engineering — explicit context window management UI
- Agent creation wizard — define new agents from the UI
- **Web monitoring dashboard** — A read-only web-accessible dashboard (separate from the Tauri desktop app) showing platform health, agent health/execution status, audit stream, and observable system data. Includes a dual-key kill switch requiring two authenticated users to activate (two-person integrity pattern). Rationale: the Tauri desktop app is the full-control cockpit for a single operator; the web dashboard is a control-tower view for team visibility and emergency response. Requires authentication layer (not present in V1) and a pending-kill-request table with expiry logic.
- **Rule Validity Agent** — An agent that periodically validates all governance rules in CLAUDE.md and UI_CLAUDE.md for continued relevance. Each rule would be stored in a governance_rules database table with metadata: intent (why the rule exists), condition (what must be true for it to apply), expiry_condition (when it should be reviewed/retired), and last_validated_at. The agent tests each rule's underlying condition, checks for inter-rule contradictions, and proposes new rules based on recurring audit log failure patterns. Markdown spec files are auto-generated from the database table as the human-readable view. Rationale: rules written at one point in time may become obsolete, incorrect, or contradictory as the system evolves. Static rules without lifecycle management accumulate technical debt. Research basis: Constitutional AI lifecycle management, policy drift detection in OPA/Rego systems.

### V3 Features
- Lower environments — dev/staging/prod environment selector with isolated databases
- Customer fine-tuning — train models on accumulated feedback data
- Multi-user / multi-tenant — separate workspaces per user

### Design Principle for Placeholders
Every V2/V3 feature should have a visible but disabled UI element with:
- A tooltip explaining what it does
- A "Coming in V2" or "Coming in V3" label
- No functionality — clicking shows an informational modal only
This ensures users and stakeholders can see the roadmap in the product itself.

---

## STARTING INSTRUCTIONS FOR EACH SESSION

At the start of every Claude Code session on the UI:
1. Read this entire UI_CLAUDE.md file
2. Run `docker compose ps` to verify infrastructure is running
3. Check if the governance API is reachable: `curl http://localhost:3000/health`
4. Ask: "Which UI phase are we in and what is the next uncompleted task?"
5. Do not begin work until the user confirms current phase and task

---

## COMPATIBILITY NOTES — WSL2 + TAURI

Known issues to handle proactively:

- **Tauri on WSL2**: Tauri cannot display a window inside WSL2 directly (no display server). Build the app in WSL2 but run it from Windows. Use `pnpm tauri build --debug` to produce a Windows installer, then install and run on Windows.
- **Alternative dev workflow**: Run `pnpm tauri dev` from Windows PowerShell (not WSL2) with the WSL2 filesystem mounted, pointing at the Node.js dev server running inside WSL2.
- **webpack/Vite HMR in WSL2**: Set `VITE_HOST=0.0.0.0` so Vite is reachable from Windows.
- **webkit2gtk**: Required for Linux builds. Install in WSL2 for Linux target compilation. Not needed for Windows builds.
- **Cross-compilation**: For production builds targeting both Windows and Linux, use GitHub Actions or build natively on each platform. Do not attempt cross-compilation from WSL2.

---

*This specification is an extension of the RSF CLAUDE.md master specification.
All rules in the parent CLAUDE.md apply here. This document governs the UI layer only.*
