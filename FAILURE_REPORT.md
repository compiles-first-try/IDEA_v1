# IDEA V1 — Complete Failure Report

**Date:** 2026-03-28
**Author:** Claude Code (honest assessment)
**Purpose:** Document everything that doesn't work, why, and what needs to change for the fresh start.

---

## What Actually Works (verified by evidence)

| Component | Evidence | Confidence |
|-----------|----------|------------|
| PostgreSQL + pgvector | 14+ events written per build, vector search returns results | HIGH |
| Redis | Kill switch flag set/cleared, build state cached, clarification responses stored | HIGH |
| Docker sandbox | Security tests pass — no network, read-only FS, memory limits, non-root | HIGH |
| Audit dual-write | Events appear in both agent_events table and audit.jsonl | HIGH |
| WebSocket server→client | 25 events delivered in server-side test (verified with ws client) | HIGH |
| Clarification detection | Claude haiku correctly identified ambiguity in TPS/FBLX spec (confidence 0.20, 3 questions) | HIGH |
| Context injection | Knowledge base chunks injected into spec interpreter prompt (score 0.65) | MEDIUM |
| Router classification | "website" specs classify as COMPLEX and route to Claude haiku | HIGH |
| Reasoning traces | All 6 pipeline stages write human-readable traces to DB | HIGH |
| Docker infrastructure | All 5 services healthy (PostgreSQL, Redis, Temporal, Jaeger, Ollama) | HIGH |

---

## What Does NOT Work

### 1. Build UI shows "Building..." forever

**Symptom:** User submits a spec, pipeline starts, stages appear to run, but UI never returns to ready state.

**Root cause (verified):** Two problems compound:

**Problem A — WebSocket race condition (fixed in latest commit but untested by user):**
- The WebSocket connection was opened AFTER `setBuildId` — by then, STAGE_STARTED and sometimes BUILD_COMPLETED events had already fired and were missed.
- Fix applied: WebSocket now connects on mount and queues events for replay.

**Problem B — Pipeline crashes silently after TEST_GENERATE (THIS IS THE REAL BUG):**
- DB evidence from Nick's last build (13:52 UTC):
  - BUILD_SUBMITTED ✓
  - 6x STAGE_STARTED ✓
  - SPEC_INTERPRET ✓
  - CODE_GENERATE ✓
  - TEST_GENERATE ✓
  - TEST_VALIDATE ← **NEVER HAPPENED**
  - QUALITY_GATES ← **NEVER HAPPENED**
  - ADVERSARIAL_REVIEW ← **NEVER HAPPENED**
  - BUILD_COMPLETED ← **NEVER HAPPENED**
- The pipeline crashed somewhere between TEST_GENERATE and TEST_VALIDATE.
- The error was caught by the governance API's outer `.catch()` block, which tries to log a FAILURE event — but if THAT log also fails (e.g., payload too large), the error is silently swallowed.
- **Result: UI waits for BUILD_COMPLETED forever. User sees "Building..." indefinitely.**

**Cascading issues:**
- `busy: true` in Zustand never resets → textarea stays disabled
- "STOP" button is visible but stopping doesn't emit BUILD_COMPLETED either
- User must refresh the page to recover

**Solution:** The governance API's async pipeline execution needs a guaranteed BUILD_COMPLETED event. Use `try/finally` — even if the pipeline crashes, emit BUILD_COMPLETED with status FAILURE.

---

### 2. STOP button doesn't actually stop the pipeline

**Symptom:** User clicks STOP, button changes to Resume, but stages still show as "running" and textarea stays disabled.

**Root cause:** Three problems:

**Problem A — Kill switch only sets a Redis flag.** The running pipeline doesn't poll Redis mid-execution. Once `v2Pipeline.run(spec)` is called, it runs to completion (or crash) regardless of the kill switch.

**Problem B — No BUILD_COMPLETED event on kill.** Even when the kill switch is activated:
- Redis flag is set ✓
- Audit event logged ✓
- But the running pipeline isn't cancelled
- No BUILD_COMPLETED FAILURE event is emitted
- UI never transitions out of "busy" state

**Problem C — useBuild listens for KILL_SWITCH_ACTIVATED to reset state.** This fix was applied but depends on WebSocket delivering the event. If the WebSocket isn't connected yet (race condition from Problem A above), the kill event is missed.

**Solution:** The pipeline needs cooperative cancellation — check kill switch flag between stages, not just at startup. And the governance API needs to guarantee a BUILD_COMPLETED event even when killed.

---

### 3. "Failed to submit build" error

**Symptom:** User clicks Build, immediately sees "Failed to submit build. Check that the governance API is running."

**Root cause:** The governance API returns an error before the build starts. Possible causes:
- Kill switch is active (previous session's kill wasn't cleared)
- CORS issue (less likely after the fix, but possible if server restarted without the fix)
- API server crashed and wasn't restarted

**Cascading issues:**
- `onMutate` in useBuild calls `startBuild()` which sets `busy: true` BEFORE the API call completes
- If the API call fails, `busy` is already true → textarea disabled → user can't retry
- Must refresh the page

**Solution:** Don't call `startBuild()` in `onMutate`. Call it in `onSuccess` after the API confirms the build was accepted.

---

### 4. Pipeline generates single functions, not real software

**Symptom:** User asks "Build a website about recursive coding" and gets a single TypeScript function, not HTML/CSS/JS files.

**Root cause:** The entire manufacturing pipeline is designed for single-function generation:
- `DetailedTargetSchema` has `functionSignature: string` (singular)
- Code generator produces one function
- Test generator tests one function
- No concept of multi-file output, project structure, or file types other than TypeScript

**This is not a bug — it's a fundamental design limitation.** The pipeline was built for "Build a function that adds two numbers" not "Build a website."

**Solution:** Requires a complete pipeline rebuild for the IDEA platform. The pipeline needs to decompose specs into project structures with multiple files, each generated and tested independently.

---

### 5. Audit log entries lack useful information when clicked

**Symptom:** User clicks on an audit row in History tab, expanded view shows empty or minimal data.

**Root cause:** Multiple issues:
- `inputs` and `outputs` are truncated to 4KB (after the fix — was 10KB before, which caused "payload too long" errors)
- Many events have empty inputs/outputs (STAGE_STARTED events only have `{ stageId, stageName }`)
- Reasoning traces were added recently but events from before that change have no traces
- The `reasoning_trace` field isn't shown for all event types — only pipeline stages

**Solution:** Every event should have meaningful inputs, outputs, and reasoning trace. Events without useful data shouldn't be shown to the user, or should be collapsed into the parent event.

---

### 6. Improvement tab shows incorrect data

**Symptom:** Improve tab shows 2-3 improvement cycles triggered when none were actually run.

**Root cause:** The metrics query counts `IMPROVEMENT_TRIGGERED` audit events. These were logged when the user clicked "Run Improvement Cycle" in the UI — but the endpoint is a stub that just logs the event and does nothing. The "improvement cycle" never actually runs.

**Cascading issue:** User thinks the system is learning. It's not. False confidence in a non-functional feature.

**Solution:** Either remove the Improve tab until the improvement loop is actually connected, or clearly label it as "Not yet functional."

---

### 7. Clarification loop timing issues

**Symptom:** Clarification questions appear, user answers, but pipeline proceeds with original spec (not enriched spec).

**Root cause:** The clarification flow has a 5-minute Redis polling loop. When the user answers:
1. Browser sends WebSocket message → server stores in Redis
2. Polling loop reads Redis → enriches spec
3. But if there's a timing mismatch (Redis write hasn't completed when poll reads), the poll misses the answer
4. Or if the WebSocket message handler fails silently, the answer is never stored

**Additional issue:** The clarification timeout is 5 minutes, during which the pipeline thread is blocked in a `while` loop with `setTimeout(1000)`. This holds a connection and doesn't release resources.

**Solution:** Use Redis pub/sub or LISTEN/NOTIFY instead of polling. The answer arrives as an event, not a polled value.

---

### 8. Context injection threshold too aggressive

**Symptom:** "Build a website for RSF" should inject RSF context but sometimes doesn't.

**Root cause:** Cosine similarity threshold was originally 0.6 (too high), lowered to 0.45. But the score depends on:
- Quality of the embedding model (nomic-embed-text)
- How the query is phrased vs how the document is written
- Whether Ollama is overloaded (embedding call can fail silently, returning empty results)

**Cascading issue:** When context injection fails silently, the spec interpreter has no project context → interprets RSF as "Research Software Foundation" → generates wrong output → user loses trust.

**Solution:** Context injection failure should be visible in the audit trail (it is now, via reasoning traces), but should also be visible to the user in the build flow ("No project context available — results may be less accurate").

---

## Systematic Issues (Not Individual Bugs)

### A. Fire-and-Forget Async Pattern

The governance API's build endpoint launches the pipeline as `(async () => { ... })().catch(...)`. This pattern:
- Returns immediately to the client (good for responsiveness)
- But provides no guaranteed completion signal (bad for reliability)
- Error in any stage can prevent BUILD_COMPLETED from firing
- Client has no way to know if the pipeline is stuck or just slow

**Every cascading issue in the build flow traces back to this pattern.**

### B. Silent Error Swallowing

51 instances of bare `catch { }` or `catch { /* comment */ }` across the codebase. Each one is a place where an error occurs and the user never knows.

### C. No State Machine for Build Lifecycle

The build has no formal state machine. States are implied by which events have fired:
- "submitted" = BUILD_SUBMITTED fired
- "running" = some STAGE_STARTED fired
- "complete" = BUILD_COMPLETED fired

But there's no transition enforcement:
- "submitted" can get stuck (no timeout)
- "running" can get stuck (pipeline crash with no BUILD_COMPLETED)
- "complete" might never fire (see #1 above)

A proper state machine would enforce: `submitted → clarifying → running → completed|failed|killed`, with timeouts on each transition.

### D. UI Tests Don't Test the System

218 tests verify React components render correctly. Zero tests verify:
- Does the pipeline produce valid output?
- Does the WebSocket deliver events to the browser?
- Does the kill switch stop a running build?
- Does clarification enrich the spec?
- Does the audit log contain useful information?

**This is why every live test discovers new bugs that automated tests miss.**

### E. Single-Function Pipeline for Multi-File Requirements

The manufacturing pipeline was designed for atomic code generation (one function at a time). Every user request that's broader than "build a function that X" will produce inadequate results because:
- No project structure decomposition
- No multi-file output
- No HTML/CSS/JS generation
- No database schema generation
- No file system output

---

## What Should Be Carried to the Fresh Start

### KEEP (proven working):
1. PostgreSQL + pgvector (database, schema, migrations V1-V5)
2. Redis (caching, pub/sub, state management)
3. Docker Compose infrastructure (all 5 services healthy)
4. Foundation package (DB client, Redis client, audit logger — after fixing truncation)
5. WebSocket audit streaming (server-side works, needs client-side race fix)
6. Clarification detection (Claude haiku ambiguity detection works)
7. Knowledge base (chunking, embedding, vector search)
8. Research documents (82 papers, living_platform.md, CLAUDE_V2.md)
9. IDEA platform spec (compiled-floating-wave.md)

### DON'T KEEP:
1. Manufacturing pipeline (single-function, can't do multi-file)
2. Tab-based React UI (replacing with chat-first)
3. 218 rendering-only tests (replace with functional tests)
4. V2 safety/capability modules (unintegrated, defer until core works)
5. Session store build state management (race conditions, stuck states)
6. MCP servers (stubs, not integrated)

### FIX THEN KEEP:
1. Audit logger truncation (reduce field size + progressive truncation)
2. WebSocket client hook (connect on mount, queue events)
3. Governance API error handling (try/finally for BUILD_COMPLETED guarantee)
4. Ollama call timeouts (actually enforce them)

---

## TDD Approach for the Fresh Start

Every component should be built with this sequence:

1. **Write the test first** — describe what the component should do
2. **Run the test** — verify it fails (red)
3. **Write the minimum code** to make the test pass (green)
4. **Refactor** if needed
5. **Write the integration test** — test with real dependencies (PostgreSQL, Redis, Ollama)
6. **Run integration test** — verify it passes
7. **Write the end-to-end test** — test the full user flow
8. **Run E2E test** — verify it passes
9. **Only then** move to the next component

**Test levels:**
- Level 1 (Unit): Functions with mocked deps, <5s
- Level 2 (Integration): Real DB/Redis/Ollama, <60s
- Level 3 (E2E): Full system flow (submit spec → receive artifacts), <5 min

**Rule: No component ships without all three levels passing.**
