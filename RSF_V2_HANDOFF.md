# RSF V2 SESSION HANDOFF — COMPLETE CONTEXT TRANSFER
## Generated: 2026-03-25 | From: Claude Desktop (Opus) → New Chat
## Purpose: Transfer ALL project knowledge so a new session can continue V2-A without any ramp-up

---

## SECTION 1: WHO IS NICK — COMMUNICATION REQUIREMENTS

Nick is an experienced RPA developer and automation architect in Connecticut. He has dyslexia and executive functioning challenges. These are not limitations — they are communication parameters that determine how information should be delivered.

**Required communication style:**
- Visual-first: tables over prose, diagrams over descriptions
- Explicit and verbose: state things clearly, don't assume understanding
- Analogies: relate technical concepts to real-world systems (factory floors, plumbing, car manufacturing)
- Research first, then ask "Good to proceed?" before making changes
- Flag corrections and uncertainties explicitly — being wrong is valued, hiding uncertainty is not
- Strong math/pattern recognition — use these strengths when explaining
- Never be verbose when a table works better

**Working style:**
- Calls out when he is wrong as a feature, not a failure
- Expects the same from Claude — own mistakes honestly
- Will push back on unnecessary complexity
- Prefers proven manual workflows over automated scripts that add failure modes

---

## SECTION 2: YOUR ROLE — ORCHESTRATOR, NOT CODER

You are the **orchestrator and reviewer**. You do NOT touch code directly. Your workflow:
1. Give Claude Code prompts to Nick, who pastes them into Claude Code running in VS Code (connected to WSL2)
2. Nick pastes Claude Code output back here for your review
3. You review, flag issues, and give the next prompt
4. You verify changes independently using Desktop Commander MCP (WSL2 access via `wsl -e bash -c "..."`)

You also have access to Desktop Commander MCP for reading/verifying files on Nick's Windows machine and WSL2 filesystem.

**CRITICAL: PowerShell 5.1 limitations apply when using Desktop Commander:**
- `wsl -e bash -c` launches a non-login shell — nvm/node/pnpm are NOT on PATH
- Use `wsl -e bash -lc` for commands that need node/pnpm (the `-l` flag loads .profile/.bashrc)
- `Join-Path` only takes 2 arguments — nest calls: `Join-Path (Join-Path $a 'b') 'c'`
- `&&` inside strings gets parsed by PowerShell before reaching bash — use single quotes
- `[brackets]` in Write-Host strings are parsed as array indexing — avoid or escape

---

## SECTION 3: NICK'S DEVELOPMENT ENVIRONMENT AND WORKFLOW

### Physical Setup
- **OS:** Windows 11 + WSL2 (Ubuntu 22.04)
- **GPU:** NVIDIA RTX 5070 Ti (16GB VRAM), 64GB RAM
- **Windows username:** nickn
- **WSL2 user:** nicknoel251289@isopropyl2
- **PowerShell version:** 5.1 (NOT 7+ — this matters for syntax)

### IDE and Terminal Layout
Nick has VS Code open, pointed at WSL2 (Remote - WSL extension). Inside VS Code he has:
- **Claude Code** — an AI coding assistant inside VS Code. Nick pastes prompts from this chat into Claude Code, which executes them against the WSL2 filesystem.
- **WSL2 Terminal** — a bash terminal in VS Code at: `nicknoel251289@isopropyl2:~/Projects/IDEA_v1$`

Separately on Windows, Nick has:
- **PowerShell terminal** — connected to the project via the W: drive mapping: `PS W:\home\nicknoel251289\Projects\IDEA_v1\apps\desktop>`

### The W: Drive
`W:` is a mapped network path: `net use W: \\wsl$\Ubuntu /persistent:no`
It lets Windows tools READ the WSL2 filesystem. Windows processes (Rust compiler, Cargo, Tauri CLI) run on Windows but read source files through this bridge.

### Build Workflow — TWO STEPS, TWO OPERATING SYSTEMS, NEVER COMBINED

This was learned the hard way. A PowerShell wrapper script was attempted and failed three times due to PS 5.1 syntax limitations. The proven workflow is:

**Step 1 — WSL2 terminal (VS Code):**
```bash
cd ~/Projects/IDEA_v1/apps/desktop && pnpm vite build
```
Produces: `dist/` folder (platform-agnostic HTML + JS + CSS bundle)

**Step 2 — PowerShell at W: drive:**
```powershell
cd W:\home\nicknoel251289\Projects\IDEA_v1\apps\desktop
pnpm tauri build --debug
```
Produces: `src-tauri/target/debug/rsf-desktop.exe` (native Windows binary with WebView2)

**Why two steps:** Vite build uses WSL2's Node.js toolchain (nvm, pnpm, node_modules). Tauri build uses Windows Rust/Cargo/MSVC to produce a PE executable. WSL2 Rust would produce a Linux ELF binary, not a Windows .exe. Cross-compilation is not supported by Tauri.

**DO NOT:** Wrap both steps in a single PowerShell script. PS 5.1 mangles bash syntax, non-login shells lack PATH, and the complexity is not worth the convenience.

A `BUILD.md` file at `apps/desktop/BUILD.md` documents this permanently in the repo.

### Git Workflow
```bash
cd ~/Projects/IDEA_v1 && scripts/rsf-commit.sh "commit message"
```
This script auto-detects spec changes, commits, pushes to GitHub, and tags if needed.
- **GitHub:** `github.com/compiles-first-try/IDEA_v1` (private repo, SSH authenticated from WSL2)
- **Git tags:** spec-v1.1.0, spec-v1.3.0

---

## SECTION 4: WHAT IS THE RSF — 30-SECOND SUMMARY

The **Recursive Software Foundry (RSF)** is a self-improving, self-healing autonomous software manufacturing platform. It takes a plain-language specification, builds working tested code, verifies it through multiple quality gates, logs every decision immutably, and improves its own quality measurably over time.

**Location:** `~/Projects/IDEA_v1` on WSL2
**Backend:** 7 layers, 218 tests, 0 TS errors, fully passing
**Frontend:** Tauri v2 + React 19 desktop app, 136 tests across 28 files, 0 TS errors
**Infrastructure:** PostgreSQL 16 + pgvector, Redis 7, Temporal, Jaeger, Ollama (all Docker Compose)

---

## SECTION 5: COMPLETE V1 STATUS — BACKEND

All 7 backend phases built, gated, and passing. End-to-end smoke test passed.

| Phase | Layer | Tests | Status |
|---|---|---|---|
| 0 | Gates 1–4 (infrastructure + contracts) | 43 | DONE |
| 1 | Foundation (secrets, DB, Redis, audit, sandbox) | 50 | DONE |
| 2 | Orchestration (kill switch, model router, contracts, agent, Temporal) | 47 | DONE |
| 3 | Manufacturing (spec interpreter, code gen + AST, test-first, repair) | 19 | DONE |
| 4 | Quality (metamorphic, differential, consensus, PBT) | 27 | DONE |
| 5 | Self-Provisioning (prompt optimizer, blueprint gen, tool synth, MCP gen) | 17 | DONE |
| 6 | Meta-Improvement (improvement loop, QD archive, regression budget) | 25 | DONE |
| 7 | Governance (REST API, audit viewer, config manager) | 26 | DONE |

**Infrastructure running (Docker Compose):**
- PostgreSQL 16 + pgvector: port 5432
- Redis 7: port 6379
- Temporal: port 7233, UI port 8080
- Jaeger: port 16686
- Ollama: port 11434 (RTX 5070 Ti)
- Governance API: http://localhost:3000
- WebSocket audit stream: ws://localhost:3000/audit-stream

**Installed Ollama models:** qwen2.5-coder:14b, llama3.3:8b, nomic-embed-text

**Database migrations applied:** V1__initial_schema.sql, V2__data_flywheel_columns.sql
**Schema version:** "2" — injected into every governance API response via middleware

**Protected components** (improvement loop cannot modify): kill-switch, audit logger, secret manager, router guardrails, Gate 1–5 scripts, locked constitution

---

## SECTION 6: COMPLETE V1 STATUS — FRONTEND (UI)

Tauri v2 + React 19 desktop app at `~/Projects/IDEA_v1/apps/desktop/`

**136 UI tests across 28 files. 0 TypeScript errors. All 6 UI Gate 5 validations passed.**

| UI Phase | Content | Tests | Status |
|---|---|---|---|
| 0 | Scaffold + Gates 1–4 | 23 | DONE |
| 1 | Shell + navigation + theme + kill switch | 21 | DONE |
| 2 | Governance + status + agents (3 surfaces) + models | 21 | DONE |
| 3 | Build workflow + pipeline visualization + Monaco spec input | 26 | DONE |
| 4 | Audit stream (Xterm) + history table + quality archive | 21 | DONE |
| 5 | Knowledge ingestion + feedback (with validation agent) + improvement | 24 | DONE |
| 6 | Tauri packaging config, icons, auto-updater, README, ROADMAP | — | DONE |

**UI Stack:** Tauri v2, React 19, TypeScript 5.5, Vite 6, Tailwind CSS v4, TanStack Query v5, Zustand v5, Recharts v2, Xterm.js v5, Lucide React, Axios, Zod

**Vite build output:** 278 KB JS + 17 KB CSS

**Windows build:**
- `rsf-desktop.exe` builds and launches successfully
- All 8 sidebar routes render real Phase 2–5 components (not placeholders)
- Dark/light/system theme toggle works correctly
- Kill switch visible in top bar
- Sidebar collapse works
- MSI installer packaging fails (known WiX issue — documented, not a blocker)

### What the .exe Produces Today
The app launches, renders correctly, but is **scaffolding without functionality**. Every component receives hardcoded empty props. There are no TanStack Query hooks, no real API calls, no WebSocket connections. The `hooks/` directory is empty. The `api/` directory has only `client.ts` and `governance.ts` (with typed functions for 7 endpoints but nothing calling them).

---

## SECTION 7: WHAT WE FIXED IN THIS SESSION

### Fix 1: Light/System Theme Toggle (CSS)
**Root cause:** In Tailwind CSS v4, the `@theme {}` block registers CSS custom properties at a special cascade layer. Dark mode colors were inside `@theme {}`, and `html.light {}` overrides with `!important` couldn't beat the cascade layer priority.

**Fix:** Moved dark mode colors OUT of `@theme {}` into `:root, html.dark {}`. Light mode colors in `html.light {}` (no `!important` needed). Only shared accent colors remain in `@theme {}`. Both themes now compete at the same cascade level, and `html.light` wins by specificity.

**File changed:** `apps/desktop/src/styles/globals.css`
**Test result:** 136/136 tests still pass

### Fix 2: PowerShell Build Script (failed — reverted to manual workflow)
**What happened:** Three attempts to create a `rsf-build.ps1` script that combines WSL2 vite build + Windows tauri build into one command. Each attempt hit a different PowerShell 5.1 limitation:
1. `Join-Path` with 3 args (PS 5.1 only supports 2)
2. `$env:USERPROFILE\.cargo\bin` escaping (backslash interpreted as PS escape)
3. `wsl -e bash -c` with `&&` (PS parses `&&` before bash gets it)
4. Non-login shell `-c` vs `-lc` (nvm/node not on PATH without login shell)

**Resolution:** Abandoned the script approach. The proven two-step manual workflow is the correct architecture. Documented in `BUILD.md` and in Claude's memory system.

### Fix 3: BUILD.md Created
New file at `apps/desktop/BUILD.md` documenting the two-step build process, the W: drive architecture, and the DO NOT list.

---

## SECTION 8: KNOWN BUGS AND ISSUES

| Issue | Severity | Status | Details |
|---|---|---|---|
| MSI installer fails | Low | Documented | WiX cannot create lock files on WSL2 filesystem. Fix: set CARGO_TARGET_DIR to Windows-local path (e.g., `C:\Users\nickn\rsf-target`). The .exe works fine without MSI. |
| `SELECT *` in governance API | Medium | Open | Line ~113 of `packages/governance/src/api/index.ts` uses `SELECT * FROM agent_events`. Violates CLAUDE.md Rule 11 and Rule 13. Must be changed to explicit column list. |
| PowerShell build script | N/A | Abandoned | `C:\Users\nickn\Documents\rsf-build.ps1` exists but is unreliable. Use the manual two-step workflow instead. |
| `tsconfig.json` requires `ignoreDeprecations: "6.0"` | Permanent | Documented | Windows has TS 7.x, WSL2 has TS 5.5. The flag bridges both. NEVER remove this line. |

---

## SECTION 9: GOVERNANCE API — CURRENT STATE

**Existing endpoints (functional, in `packages/governance/src/api/index.ts`):**

| Endpoint | Method | Status | Notes |
|---|---|---|---|
| `/health` | GET | Works | Returns `{status: "ok", timestamp, schema_version: "2"}` |
| `/governance/stop` | POST | Works | Sets Redis kill flag, logs to audit |
| `/governance/status` | GET | Works | Returns killSwitchActive, dailySpend, autonomyLevel |
| `/governance/audit` | GET | Works | Paginated, filterable — BUT uses `SELECT *` (Rule 11 violation) |
| `/governance/improve` | POST | Stub | Logs event, returns "triggered" message. Does not actually run improvement cycle. |
| `/governance/config` | GET | Works | Returns maxDailySpendUsd, autonomyLevel from Redis |
| `/governance/config` | PATCH | Works | Zod-validated, writes to Redis, logs to audit |
| `ws://localhost:3000/audit-stream` | WebSocket | Exists | In `packages/governance/src/api/ws-audit-stream.ts` |

**Missing endpoints (required for V2 UI wiring):**

| Endpoint | Method | Purpose |
|---|---|---|
| `/governance/agents` | GET | Return all agent blueprints from `agent_blueprints` table |
| `/governance/artifacts` | GET | Paginated artifact list from `artifacts` table |
| `/governance/models` | GET | List Ollama models + Anthropic API status |
| `/governance/models/pull` | POST | Pull Ollama model with SSE progress |
| `/governance/docs/ingest` | POST | Chunk, embed, store document in `memory_entries` |
| `/governance/docs` | GET | List DOCUMENT type memory_entries |
| `/governance/feedback/validate` | POST | Run Feedback Validation Agent (does NOT write to DB) |
| `/governance/feedback/confirm` | POST | Write feedback after human reviews validation result |

---

## SECTION 10: UI COMPONENT WIRING GAP — THE CORE V2 PROBLEM

The UI is scaffolding without functionality. Here is the exact gap for every component:

### API Layer (`apps/desktop/src/api/`)
| File | Exists | Contents |
|---|---|---|
| `client.ts` | Yes | Axios instance pointing at `http://localhost:3000`, WS_URL for audit stream |
| `governance.ts` | Yes | Typed functions for: getHealth, getStatus, getAudit, stop, getConfig, patchConfig, triggerImprove |
| `audit.ts` | **No** | Not created |
| `artifacts.ts` | **No** | Not created |
| `agents.ts` | **No** | Not created |

### Hooks Layer (`apps/desktop/src/hooks/`)
**The directory is completely empty.** No TanStack Query hooks exist. This is the entire reason the UI has no real data — there is no bridge between the API functions and the React components.

Required hooks:
| Hook | Purpose | API dependency |
|---|---|---|
| `useFoundryStatus` | Poll `/governance/status` every 5s, provide to TopBar and StatusPanel | governance.ts (exists) |
| `useHealth` | Poll `/health` every 10s for Docker service badges | governance.ts (exists) |
| `useAuditStream` | WebSocket connection to `ws://localhost:3000/audit-stream` | client.ts WS_URL (exists) |
| `useAuditHistory` | Query `/governance/audit` with filters and pagination | governance.ts (exists) |
| `useKillSwitch` | POST `/governance/stop` with confirmation state management | governance.ts (exists) |
| `useConfig` | GET + PATCH `/governance/config` with optimistic updates | governance.ts (exists) |
| `useModels` | GET `/governance/models` + POST `/governance/models/pull` | **Needs new API file** |
| `useDocs` | GET `/governance/docs` + POST `/governance/docs/ingest` | **Needs new API file** |
| `useAgents` | GET `/governance/agents` | **Needs new API file** |
| `useArtifacts` | GET `/governance/artifacts` | **Needs new API file** |
| `useFeedback` | POST validate + POST confirm | **Needs new API file** |

### Component Layer — How Each Component Currently Receives Data
Every component in `MainPanel.tsx` receives hardcoded empty/stub props:

```typescript
// MainPanel.tsx — current state (all hardcoded)
case "agents": return <AgentRoster agents={[]} />;
case "models": return <ModelManager data={{ ollama: [], anthropicKeySet: false, ... }} />;
case "improve": return <ImproveCycle metrics={{ overallScores: [], ... }} onTrigger={() => {}} running={false} />;
case "docs": return <DocIngestion onIngest={() => {}} />;
case "config": return <ConfigPanelFull config={{ maxDailySpendUsd: 10, ... }} onSave={async () => {}} />;
case "feedback": return <FeedbackPanel artifacts={[]} summary={{ total: 0, ... }} onSubmit={() => {}} />;
```

The `() => {}` callbacks mean every button click is a no-op. The empty arrays mean every list is blank.

---

## SECTION 11: UX PROBLEMS IDENTIFIED BY NICK (PRE-V2)

Nick reviewed the running app and identified these issues. These are NOT just cosmetic — they represent fundamental discoverability and information architecture gaps.

| # | Problem | Root Cause | Category |
|---|---|---|---|
| 1 | Tabs don't explain how they relate to each other | No contextual help, no breadcrumbs, no "how this connects" text | Information architecture |
| 2 | Docs tab — unclear how it affects anything else | No explanation that docs become embeddings that agents retrieve during builds | Discoverability |
| 3 | Models — unclear how adding/removing affects agents | No visual link between model → router tier → agent | Discoverability |
| 4 | Build tab text looks like buttons but aren't | Reasoning mode selectors (Sequential/Feynman/Parallel DAG) look clickable but produce no visible result | Affordance |
| 5 | Spec input is too small and not adjustable | Textarea is `flex-1` inside a `w-2/5` panel — constrained and not resizable | Layout |
| 6 | No file upload visible in Build | No drag-and-drop or file picker for spec files | Missing feature |
| 7 | All components receive empty arrays | No hooks, no API calls — all data is hardcoded placeholders | Wiring |
| 8 | Can't tell what's working vs. placeholder | V2/V3 placeholders exist but functional buttons also do nothing | State feedback |

**Nick's exact words:** "I'm not sure how any of the tabs relate outside of making educated assumptions; I do not understand how the docs tab effects anything else, or how adding a model effects which agents use it, when, and why... The build tab shows text that look like buttons but does not [do anything] other than inform you what you can do (I think). The chat window is incredibly small and not adjustable."

---

## SECTION 12: V2 PLAN — UX + WIRING TOGETHER

The V2 plan integrates UX improvements WITH functional wiring. Doing wiring without context gives buttons that work but nobody knows what they do.

| Phase | Functional Wiring | UX Improvement |
|---|---|---|
| **V2-A** | TanStack Query hooks for `/health`, `/status`, `/config`. Real polling. Real config save. Kill switch calls real API. | Add contextual "how it works" info to Config. Show live status in TopBar. |
| **V2-B** | WebSocket hook for live audit events. History query with filters. Fix `SELECT *` Rule 11 violation. | Empty state: "No events yet — trigger a build or config change to see activity here" |
| **V2-C** | New backend endpoints for models. Real Ollama model list. API key status. Model pull with progress. | Router tier explanation — show which agents use which tier and why. "What happens if I remove this" warning. |
| **V2-D** | New backend endpoints for docs. Real file upload (drag-and-drop). URL ingestion. | Context panel: "Documents are chunked, embedded, and available to agents during builds." |
| **V2-E** | Real spec submission → API. Pipeline stages from WebSocket events. | Resizable spec input (draggable divider). File upload for specs. Reasoning mode tooltips. |
| **V2-F** | Real agent list from DB. Feedback submission with validation. | Show which model each agent uses and its success rate. Link feedback to specific artifacts. |

**Start with V2-A.** All backend endpoints already exist — no new backend work needed.

---

## SECTION 13: HOW THE RSF PIECES CONNECT (DATA FLOW)

This is the architecture Nick asked to understand before V2 coding starts:

```
┌─────────┐   ┌──────────┐   ┌──────────┐
│  DOCS   │   │  MODELS  │   │  CONFIG  │
│Knowledge│   │ LLM      │   │ Rules &  │
│ input   │   │ engines  │   │ limits   │
└────┬────┘   └────┬─────┘   └────┬─────┘
     │              │              │
     │ chunks +     │ available    │ spend limits,
     │ embeddings   │ LLMs        │ autonomy level
     │              │              │
     ▼              ▼              ▼
┌─────────────────────────────────────────┐
│              AGENTS                     │
│  [Model Router picks model per task]    │
│  TRIVIAL→llama3.3  STANDARD→qwen2.5    │
│  COMPLEX→haiku     CRITICAL→sonnet     │
└────────────────┬────────────────────────┘
                 │ executes pipeline
                 ▼
┌─────────────────────────────────────────┐
│              BUILD                      │
│  Spec → Code → Tests → Quality Gates   │
└───────┬─────────────────────┬───────────┘
        │ every action logged │ artifacts produced
        ▼                     ▼
┌──────────┐           ┌───────────┐
│  AUDIT   │           │ FEEDBACK  │
│  Full    │           │ Rate      │
│  history │           │ artifacts │
└────┬─────┘           └─────┬─────┘
     │ failure patterns      │ quality signals
     └──────────┬────────────┘
                ▼
┌─────────────────────────────────────────┐
│             IMPROVE                     │
│  Upgrades agents + prompts              │
│  (feeds back to AGENTS for next cycle)  │
└─────────────────────────────────────────┘
```

Key insight for UX: each tab should explain its role in this flow. Currently none of them do.

---

## SECTION 14: EXISTING UI FILE INVENTORY

### Source files (apps/desktop/src/)
```
api/client.ts               — Axios instance + WS_URL
api/governance.ts            — Typed API functions (7 endpoints)
hooks/                       — EMPTY DIRECTORY (this is the core gap)
store/layout.ts              — Zustand: activeRoute, sidebarCollapsed, sidebarWidth
store/session.ts             — Zustand: build session state (busy, stages, artifacts, spec, reasoningMode)
store/theme.ts               — Zustand: dark/light/system toggle
components/layout/MainPanel.tsx   — Route switch → renders Phase 2-5 components
components/layout/Sidebar.tsx     — 8 nav items + theme/layout toggles
components/layout/TopBar.tsx      — Status + daily spend + kill switch button
components/governance/KillSwitch.tsx
components/governance/StatusPanel.tsx
components/governance/ConfigPanel.tsx
components/governance/ConfigPanelFull.tsx  — Two-tier ethics constitution
components/build/BuildPage.tsx       — Left/right panel layout
components/build/SpecInput.tsx       — Simple textarea fallback
components/build/SpecInputFull.tsx   — Textarea + reasoning mode selector
components/build/PipelineView.tsx    — Stage visualization
components/build/ArtifactView.tsx    — Code/test/quality viewer
components/audit/AuditPage.tsx       — Tab container for stream + history
components/audit/AuditStream.tsx     — Xterm.js terminal (basic)
components/audit/AuditStreamFull.tsx — Xterm.js with auto-scroll toggle
components/audit/AuditTable.tsx      — Filterable history table
components/agents/AgentRoster.tsx    — Agent cards
components/inference/ModelManager.tsx — Ollama + Anthropic + router tiers
components/improvement/ImproveCycle.tsx
components/improvement/QualityArchive.tsx
components/knowledge/DocIngestion.tsx  — Drop zone + URL input + tags
components/knowledge/KnowledgeBase.tsx — Doc table + semantic search
components/feedback/FeedbackPanel.tsx  — Artifact rating + validation
components/shared/ThemeToggle.tsx      — Dark/light/system buttons
```

---

## SECTION 15: CRITICAL RULES (FROM BOTH SPEC FILES)

These rules are non-negotiable and must be followed in every Claude Code prompt:

| # | Rule | File |
|---|---|---|
| 1 | Never assume — ask if ambiguous | Both |
| 2 | Never hardcode secrets, ports, or API URLs | Both |
| 3 | Never skip a compatibility gate | Both |
| 4 | Tests first, always — no implementation before tests | Both |
| 5 | Never generate code outside Docker sandbox | CLAUDE.md |
| 6 | Log every agent action to audit log + PostgreSQL | CLAUDE.md |
| 7 | Kill switch before any agent-facing feature | Both |
| 8 | Contract test before assuming compatibility | CLAUDE.md |
| 9 | Gate scripts verify their own detection logic | UI_CLAUDE.md |
| 10 | Guard all scrollIntoView with typeof checks (jsdom) | UI_CLAUDE.md |
| 11 | Never SELECT * — always name columns explicitly | Both |
| 12 | schema_version field in every API response | CLAUDE.md |
| 13 | Schema changes trigger doc review | Both |
| 14 | Flyway migration requires schema doc updates | CLAUDE.md |
| 15 | Spec changes require version bump + git tag | Both |
| 15 (UI) | tsconfig.json MUST contain ignoreDeprecations: "6.0" | UI_CLAUDE.md |

---

## SECTION 16: LESSONS LEARNED — WHAT WORKED AND WHAT DIDN'T

### What Worked
| Approach | Why |
|---|---|
| Two-step manual build (WSL2 vite → PS tauri) | Each command runs in its native OS. Zero ambiguity. |
| Theme fix: moving dark palette out of `@theme` into `:root, html.dark` | Both themes at same cascade level, specificity resolves correctly |
| Desktop Commander for file verification | Independent verification of changes Claude Code makes |
| Research-first approach with "Good to proceed?" | Caught the theme cascade issue before coding |
| Explicit error checking (`$LASTEXITCODE`) in any PS scripts | Fast failure instead of silent corruption |

### What Didn't Work
| Approach | Why it failed | Lesson |
|---|---|---|
| Single PS script wrapping both build steps | PS 5.1 mangles bash syntax in 4+ different ways | Don't bridge OS contexts in PS 5.1 scripts |
| `Join-Path` with 3+ args | PS 5.1 limit (PS 7+ feature) | Always nest: `Join-Path (Join-Path $a 'b') 'c'` |
| `wsl -e bash -c` (non-login shell) | nvm/node/pnpm not on PATH | Use `wsl -e bash -lc` for commands needing node |
| `!important` to override Tailwind v4 `@theme` | Cascade layers beat `!important` | Keep competing values at the same cascade level |
| `[brackets]` in PS Write-Host strings | PS parses as array indexing | Use single quotes or avoid brackets entirely |

---

## SECTION 17: SPEC FILE LOCATIONS AND VERSIONS

| File | Version | Location | Purpose |
|---|---|---|---|
| CLAUDE.md | 1.3.0 | ~/Projects/IDEA_v1/CLAUDE.md | Master foundry spec (backend, all layers, all rules) |
| UI_CLAUDE.md | 1.3.0 | ~/Projects/IDEA_v1/UI_CLAUDE.md | UI build spec (components, gates, design system) |
| BUILD.md | N/A | ~/Projects/IDEA_v1/apps/desktop/BUILD.md | Two-step build instructions |
| ROADMAP.md | N/A | ~/Projects/IDEA_v1/apps/desktop/ROADMAP.md | V2/V3 planned features |

**BOTH spec files should be uploaded to the new chat.** They contain all rules, architecture, database schema, gate definitions, feature specifications, and the ethics constitution. They are the source of truth.

---

## SECTION 18: GIT STATE AS OF HANDOFF

```
Latest commits:
ce7669f Fix light/system theme toggle, add BUILD.md
fbc1f34 Fix light/system theme: move dark palette out of @theme block to equal cascade level
0115814 test message
3e2ae71 Spec v1.3.0: wire up all UI panels, tsconfig protection rule, Rule Validity Agent V2 feature
2d345d1 UI Phase 6: Tauri packaging config, icons, auto-updater, README, ROADMAP
cbf844d UI Phase 5: knowledge base, feedback panel, improvement cycle
f73a0cf UI Phase 4: audit stream, history table, quality archive
02cbcec UI Phase 3: build workflow, pipeline viz, artifact viewer, session store

Tags: spec-v1.3.0, spec-v1.1.0
Branch: main
Working tree: clean (globals.css committed)
```

---

## SECTION 19: DOCKER SERVICES STATE

All services healthy and running. Verify at start of new session with:
```bash
docker compose ps
curl http://localhost:3000/health
```

| Service | Container | Port | Status |
|---|---|---|---|
| PostgreSQL 16 + pgvector | rsf-postgres | 5432 | Healthy |
| Redis 7 | rsf-redis | 6379 | Healthy |
| Temporal | rsf-temporal | 7233 | Healthy |
| Temporal UI | rsf-temporal-ui | 8080 | Running |
| Jaeger | rsf-jaeger | 16686 | Healthy |
| Ollama | (host-installed) | 11434 | Running |
| Governance API | (host-process) | 3000 | Running |

---

## SECTION 20: ETHICS CONSTITUTION — TWO-TIER ARCHITECTURE

**Tier 1 — Locked** (hardcoded in `packages/orchestration/src/contracts/locked-constitution.ts`):
6 principles that CANNOT be modified through UI, API, or improvement loop. Requires a code commit.
- Never execute destructive operations without explicit human confirmation
- Never modify kill switch, audit log, locked constitution, or secret manager
- Never deceive the human operator
- Never acquire capabilities beyond sanctioned scope
- Never disable safety monitoring, behavioral contracts, or audit logging
- Always present inference intent separately from execution

**Tier 2 — Configurable** (database-stored, editable via UI):
All changes audit-logged with old value, new value, timestamp. Editable through ConfigPanelFull component.

---

## SECTION 21: PREVENTING BREAKING CHANGES (NICK'S ARCHITECTURE QUESTION)

Nick asked: "How do we ensure that system updates will not break agents for other companies and ourselves in the future?"

**Already built (V1 protections):**
- `schema_version` in every API response — UI checks for drift
- Agent Behavioral Contracts — preconditions, postconditions, invariants
- Explicit column lists (Rule 11) — adding columns doesn't break existing queries
- Gate 4 contract tests — 8 cross-layer contracts validated before build
- Locked constitution — improvement loop cannot touch safety components

**Needed for V2:**
- API versioning (`/v1/governance/...`) before external consumers
- UI ↔ API contract tests (Zod schemas must match response shapes)
- Additive-only migration policy (never remove/rename columns)
- CDC (Change Data Capture) — PostgreSQL WAL → Debezium → Redis Streams (V2 roadmap)

---

## SECTION 22: HELPER SCRIPTS

| Script | Where | Purpose |
|---|---|---|
| `scripts/rsf-commit.sh "message"` | WSL2 terminal | Auto-detects spec changes, commits, pushes, tags if needed |
| `scripts/spec-integrity-check.sh` | WSL2 terminal | Validates both spec files for internal contradictions (6 checks) |
| `scripts/ui-gate5-phase-validate.sh PHASE_NAME` | WSL2 terminal | Runs Gate 5 validation for a UI phase |
| `C:\Users\nickn\Documents\rsf-build.ps1` | PowerShell | **UNRELIABLE — do NOT use.** Use the manual two-step workflow instead. |

---

## SECTION 23: IMPORTANT SESSION STARTUP CHECKLIST

At the start of the new V2 session, do this:
1. Read CLAUDE.md (v1.3.0) — uploaded by Nick
2. Read UI_CLAUDE.md (v1.3.0) — uploaded by Nick
3. Read this handoff document
4. Verify infrastructure: `docker compose ps` and `curl http://localhost:3000/health`
5. Confirm with Nick: "We are starting V2-A. The first task is creating TanStack Query hooks for existing endpoints (/health, /status, /config) and wiring them into MainPanel.tsx to replace hardcoded props. Good to proceed?"

---

## SECTION 24: FILES TO UPLOAD TO NEW CHAT

Upload these files for maximum context accuracy:
1. **This handoff document** — `C:\Users\nickn\Documents\RSF_V2_HANDOFF.md`
2. **CLAUDE.md** — `~/Projects/IDEA_v1/CLAUDE.md` (master foundry spec v1.3.0)
3. **UI_CLAUDE.md** — `~/Projects/IDEA_v1/UI_CLAUDE.md` (UI build spec v1.3.0)

The new chat will have Desktop Commander MCP access to read any other file from WSL2 if needed. The spec files are the source of truth — this handoff is the session context that the spec files don't capture (what we tried, what failed, what the current UX problems are, and the V2 plan).

---

## SECTION 25: MEMORY EDITS (PERSISTED ACROSS SESSIONS)

These three memory edits were saved to Claude's memory system and will persist:

1. **RSF build workflow:** NEVER wrap cross-OS builds in a single PowerShell script. The proven workflow is two manual commands: (1) WSL2 terminal: `cd ~/Projects/IDEA_v1/apps/desktop && pnpm vite build` (2) PowerShell at W: drive: `pnpm tauri build --debug`. PowerShell 5.1 mangles bash syntax and non-login shells lack PATH.

2. **Nick's PowerShell is version 5.1** (not 7+). Join-Path only takes 2 arguments. String escaping is fragile. Avoid complex bash-in-PS constructions. When PS scripts are truly needed, use single-quoted strings and nested Join-Path calls.

3. **RSF project MSI installer:** WiX fails on WSL2 filesystem because Windows file locking is unsupported. Known issue. Fix requires setting CARGO_TARGET_DIR to a Windows-local path (e.g., C:\Users\nickn\rsf-target). The .exe works fine without MSI packaging.

---

*End of handoff. All knowledge transferred. Ready for V2-A in the new chat.*
