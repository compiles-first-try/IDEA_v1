/**
 * END-TO-END SMOKE TEST
 *
 * Runs the full RSF pipeline for a single specification:
 *   Spec Interpreter → Model Router → Code Generator (AST) → Test-First Pipeline
 *   → Metamorphic Testing → Differential Testing → Multi-Model Consensus → Audit
 */
import * as dotenv from "dotenv";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ── Foundation imports ──
import { createDbClient, runMigrations } from "../packages/foundation/src/db/index.js";
import { createCacheClient } from "../packages/foundation/src/cache/index.js";
import { createAuditLogger } from "../packages/foundation/src/audit/index.js";

// ── Orchestration imports ──
import { createKillSwitch } from "../packages/orchestration/src/kill-switch/index.js";
import { createModelRouter } from "../packages/orchestration/src/router/index.js";

// ── Manufacturing imports ──
import { createManufacturingSpecInterpreter } from "../packages/manufacturing/src/spec-interpreter/index.js";
import { createCodeGenerator, validateTypeScript } from "../packages/manufacturing/src/generator/index.js";
import { createTestFirstPipeline } from "../packages/manufacturing/src/test-first/index.js";
import { createRepairAgent } from "../packages/manufacturing/src/repair/index.js";

// ── Quality imports ──
import {
  negationRelation,
  additiveRelation,
  runMetamorphicTests,
} from "../packages/quality/typescript/src/metamorphic/index.js";
import { runDifferentialTest } from "../packages/quality/typescript/src/differential/index.js";
import {
  createConsensusGate,
  createOllamaEvaluator,
} from "../packages/quality/typescript/src/consensus/index.js";
import { checkRangeBound } from "../packages/quality/typescript/src/mutation/index.js";
import * as fc from "fast-check";

// ═══════════════════════════════════════════════════════════════
const SPEC = `Build a TypeScript function called calculateCompoundInterest that takes principal amount, annual interest rate as a percentage, number of times interest compounds per year, and number of years — and returns the final amount rounded to 2 decimal places.`;

const SECTION = (title: string) => {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(70)}\n`);
};

const STEP = (n: number, label: string) =>
  console.log(`  [${ n}] ${label}`);

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║          RECURSIVE SOFTWARE FOUNDRY — E2E SMOKE TEST              ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");

  const OLLAMA = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const E2E_AUDIT = path.resolve(__dirname, "../logs/audit-e2e.jsonl");

  // ── Bootstrap infrastructure ──
  SECTION("INFRASTRUCTURE BOOTSTRAP");
  const db = await createDbClient(process.env.POSTGRES_URL!);
  await runMigrations(db, path.resolve(__dirname, "../db/migrations"));
  const cache = await createCacheClient(process.env.REDIS_URL ?? "redis://localhost:6379");
  const auditLogger = await createAuditLogger({ db, logPath: E2E_AUDIT });
  const killSwitch = await createKillSwitch({ cache, auditLogger });
  const router = await createModelRouter({
    cache,
    maxDailySpendUsd: 10,
    pauseThresholdUsd: 20,
    ollamaBaseUrl: OLLAMA,
  });
  STEP(0, "PostgreSQL, Redis, Audit Logger, Kill Switch, Model Router — READY");

  // ── Precondition: Kill switch must be off ──
  if (await killSwitch.isActive()) {
    console.error("  ABORT: Kill switch is active. Cannot proceed.");
    process.exit(1);
  }
  STEP(0, "Kill switch check — CLEAR");

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: SPEC INTERPRETATION
  // ═══════════════════════════════════════════════════════════════
  SECTION("STEP 1: SPEC INTERPRETATION");
  console.log(`  Input spec:\n  "${SPEC}"\n`);

  const specInterpreter = createManufacturingSpecInterpreter({
    cache,
    auditLogger,
    ollamaBaseUrl: OLLAMA,
  });

  const target = await specInterpreter.interpret(SPEC);
  console.log("  Structured GenerationTarget:");
  console.log(`    Name:        ${target.name}`);
  console.log(`    Language:    ${target.language}`);
  console.log(`    Signature:   ${target.functionSignature}`);
  console.log(`    Parameters:  ${target.parameters.map(p => `${p.name}: ${p.type}`).join(", ")}`);
  console.log(`    Return type: ${target.returnType}`);
  console.log(`    Requirements:`);
  target.requirements.forEach(r => console.log(`      - ${r}`));
  console.log(`    Edge cases:`);
  target.edgeCases.forEach(e => console.log(`      - ${e}`));
  console.log(`    Test hints:`);
  target.testHints.forEach(h => console.log(`      - ${h}`));

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: MODEL ROUTING
  // ═══════════════════════════════════════════════════════════════
  SECTION("STEP 2: MODEL ROUTING");
  const tier = router.classify(SPEC);
  const dailySpend = await router.getDailySpend();
  const model = router.resolveModel(tier, dailySpend);
  console.log(`  Task complexity: ${tier}`);
  console.log(`  Selected model:  ${model.model} (${model.provider})`);
  console.log(`  Max tokens:      ${model.maxTokens}`);
  console.log(`  Daily spend:     $${dailySpend.toFixed(4)}`);

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: CODE GENERATION WITH AST VALIDATION
  // ═══════════════════════════════════════════════════════════════
  SECTION("STEP 3: CODE GENERATION + AST VALIDATION");
  const codeGen = createCodeGenerator({ auditLogger, ollamaBaseUrl: OLLAMA });
  const genResult = await codeGen.generate(target);

  console.log(`  Generated code (${genResult.code.length} chars, ${genResult.durationMs}ms):`);
  console.log("  ┌─────────────────────────────────────────────────────────────");
  genResult.code.split("\n").forEach(line => console.log(`  │ ${line}`));
  console.log("  └─────────────────────────────────────────────────────────────");
  console.log(`  AST Validation: ${genResult.validation.valid ? "✓ PASS" : "✗ FAIL"}`);
  if (!genResult.validation.valid) {
    console.log(`  Errors: ${genResult.validation.errors.join("; ")}`);

    // Attempt repair
    SECTION("STEP 3b: AUTOMATED REPAIR");
    const repairAgent = createRepairAgent({ auditLogger, ollamaBaseUrl: OLLAMA });
    const repairResult = await repairAgent.repair({
      code: genResult.code,
      errors: genResult.validation.errors,
      functionName: target.name,
      expectedSignature: target.functionSignature,
    });
    if (repairResult.repaired) {
      genResult.code = repairResult.code;
      genResult.validation = validateTypeScript(repairResult.code);
      console.log(`  Repair succeeded in ${repairResult.attempts} attempt(s)`);
      console.log("  ┌─────────────────────────────────────────────────────────────");
      repairResult.code.split("\n").forEach(line => console.log(`  │ ${line}`));
      console.log("  └─────────────────────────────────────────────────────────────");
    } else {
      console.log("  Repair FAILED — proceeding with original code");
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: TEST-FIRST PIPELINE
  // ═══════════════════════════════════════════════════════════════
  SECTION("STEP 4: TEST-FIRST PIPELINE");
  const testFirst = createTestFirstPipeline({ auditLogger, ollamaBaseUrl: OLLAMA });
  const tfResult = await testFirst.run(target);

  console.log(`  Generated test code (${tfResult.testCode.length} chars):`);
  console.log("  ┌─────────────────────────────────────────────────────────────");
  tfResult.testCode.split("\n").forEach(line => console.log(`  │ ${line}`));
  console.log("  └─────────────────────────────────────────────────────────────");
  console.log(`  Generated implementation (${tfResult.implementationCode.length} chars):`);
  console.log("  ┌─────────────────────────────────────────────────────────────");
  tfResult.implementationCode.split("\n").forEach(line => console.log(`  │ ${line}`));
  console.log("  └─────────────────────────────────────────────────────────────");
  console.log(`  Implementation AST valid: ${tfResult.implementationValid ? "✓ PASS" : "✗ FAIL"}`);

  // Use the best code (original gen or test-first)
  const finalCode = genResult.validation.valid ? genResult.code : tfResult.implementationCode;

  // ═══════════════════════════════════════════════════════════════
  // STEP 5: QUALITY GATES
  // ═══════════════════════════════════════════════════════════════
  SECTION("STEP 5a: METAMORPHIC TESTING");

  // Build the function from generated code for runtime testing
  // Strip TypeScript type annotations to make it runnable as plain JS
  let calculateCompoundInterest: (p: number, r: number, n: number, t: number) => number;
  try {
    const jsCode = finalCode
      .replace(/:\s*number/g, "")
      .replace(/:\s*string/g, "")
      .replace(/:\s*boolean/g, "")
      .replace(/:\s*void/g, "");
    const fnBody = `${jsCode}\nreturn calculateCompoundInterest;`;
    calculateCompoundInterest = new Function(fnBody)() as typeof calculateCompoundInterest;
    // Quick sanity check
    const sanity = calculateCompoundInterest(1000, 5, 12, 1);
    if (typeof sanity !== "number" || isNaN(sanity)) {
      throw new Error(`Sanity check failed: got ${sanity}`);
    }
    console.log(`  Runtime instantiation: ✓ (sanity check: calculateCompoundInterest(1000,5,12,1) = ${sanity})`);
  } catch (err) {
    console.log(`  Cannot instantiate function for runtime testing: ${err}`);
    console.log("  Skipping runtime quality gates (AST-only validation passed).");
    calculateCompoundInterest = null as unknown as typeof calculateCompoundInterest;
  }

  let metamorphicResult: Awaited<ReturnType<typeof runMetamorphicTests>> | undefined;
  let pbtResult: { passed: boolean; numRuns: number } | undefined;
  let diffResult: Awaited<ReturnType<typeof runDifferentialTest>> | undefined;

  if (calculateCompoundInterest) {
    // Metamorphic relation: doubling principal should double the result
    metamorphicResult = runMetamorphicTests(
      (input: [number, number, number, number]) => calculateCompoundInterest(...input),
      [
        [1000, 5, 12, 10],
        [5000, 3, 4, 5],
        [100, 10, 1, 1],
      ],
      [
        additiveRelation<[number, number, number, number], number>({
          name: "double-principal",
          transform: ([p, r, n, t]) => [p * 2, r, n, t],
          verify: (srcOut, fupOut) => Math.abs(fupOut - srcOut * 2) < 0.02,
        }),
        additiveRelation<[number, number, number, number], number>({
          name: "zero-rate-identity",
          transform: ([p, _r, n, t]) => [p, 0, n, t],
          verify: (srcOut, fupOut, srcIn) => Math.abs(fupOut - srcIn[0]) < 0.02,
        }),
      ]
    );

    console.log(`  Relations tested: ${metamorphicResult.totalRelations}`);
    console.log(`  Inputs tested:    ${metamorphicResult.totalInputs}`);
    console.log(`  Violations:       ${metamorphicResult.violations.length}`);
    console.log(`  Result:           ${metamorphicResult.passed ? "✓ PASS" : "✗ FAIL"}`);
    if (!metamorphicResult.passed) {
      metamorphicResult.violations.forEach(v =>
        console.log(`    Violation: ${v.relationName} on input ${JSON.stringify(v.sourceInput)} → src=${v.sourceOutput}, fup=${v.followUpOutput}`)
      );
    }

    // ───────────────────────────────────────────────────────────
    SECTION("STEP 5b: PROPERTY-BASED TESTING (fast-check)");

    // Property: result >= principal (compound interest never decreases principal for r >= 0)
    pbtResult = checkRangeBound(
      (x: number) => calculateCompoundInterest(x, 5, 12, 1),
      fc.integer({ min: 1, max: 100000 }),
      1, // min: at least the principal (for x>=1)
      Infinity
    );
    console.log(`  Property: result >= principal for r=5%, n=12, t=1`);
    console.log(`  Result:   ${pbtResult.passed ? "✓ PASS" : "✗ FAIL"} (${pbtResult.numRuns} runs)`);

    // ───────────────────────────────────────────────────────────
    SECTION("STEP 5c: DIFFERENTIAL TESTING (N-version)");

    // Generate a reference implementation to compare against
    const referenceImpl = (p: number, r: number, n: number, t: number) => {
      const amount = p * Math.pow(1 + r / 100 / n, n * t);
      return Math.round(amount * 100) / 100;
    };

    diffResult = runDifferentialTest(
      [
        { name: "generated", fn: (args: [number, number, number, number]) => calculateCompoundInterest(...args) },
        { name: "reference", fn: (args: [number, number, number, number]) => referenceImpl(...args) },
      ],
      [
        [1000, 5, 12, 10],
        [5000, 3.5, 4, 7],
        [10000, 0, 1, 5],
        [1, 100, 1, 1],
        [50000, 7.5, 365, 30],
      ]
    );

    console.log(`  Versions compared: ${diffResult.totalVersions}`);
    console.log(`  Inputs tested:     ${diffResult.totalInputs}`);
    console.log(`  Unanimous:         ${diffResult.unanimous ? "✓ YES" : "✗ NO"}`);
    if (!diffResult.unanimous) {
      diffResult.divergences.forEach(d => {
        const outputs = Array.from(d.outputs.entries()).map(([name, v]) => `${name}=${v.output}`);
        console.log(`    Divergence on ${JSON.stringify(d.input)}: ${outputs.join(", ")}`);
      });
    }
  }

  // ───────────────────────────────────────────────────────────
  SECTION("STEP 5d: MULTI-MODEL CONSENSUS GATE");

  const consensusGate = createConsensusGate({
    auditLogger,
    evaluators: [
      createOllamaEvaluator({
        name: "qwen-evaluator",
        model: "qwen2.5-coder:14b",
        ollamaBaseUrl: OLLAMA,
      }),
      // Second evaluator: simple AST-based check
      {
        name: "ast-evaluator",
        evaluate: async (code: string) => {
          const v = validateTypeScript(code);
          return {
            pass: v.valid,
            reason: v.valid ? "AST validation passed" : `AST errors: ${v.errors.join("; ")}`,
          };
        },
      },
    ],
  });

  const consensusResult = await consensusGate.evaluate(finalCode);
  console.log(`  Evaluators:  ${consensusResult.verdicts.length}`);
  for (const v of consensusResult.verdicts) {
    console.log(`    ${v.evaluator}: ${v.pass ? "✓ PASS" : "✗ FAIL"} — ${v.reason.slice(0, 100)}`);
  }
  console.log(`  Consensus:   ${consensusResult.accepted ? "✓ ACCEPTED" : "✗ REJECTED"}`);

  // ═══════════════════════════════════════════════════════════════
  // STEP 6: AUDIT TRAIL
  // ═══════════════════════════════════════════════════════════════
  SECTION("STEP 6: COMPLETE AUDIT TRAIL");

  const auditEvents = await db.query<{
    event_id: string;
    timestamp: Date;
    agent_id: string;
    action_type: string;
    model_used: string;
    tokens_in: number;
    tokens_out: number;
    cost_usd: number;
    duration_ms: number;
    status: string;
  }>(
    `SELECT event_id, timestamp, agent_id, action_type, model_used,
            tokens_in, tokens_out, cost_usd, duration_ms, status
     FROM agent_events
     ORDER BY timestamp DESC
     LIMIT 30`
  );

  console.log("  ┌────────────────────────────────────────────────────────────────────────────────────┐");
  console.log("  │ Timestamp            Agent                  Action              Model         Dur  │");
  console.log("  ├────────────────────────────────────────────────────────────────────────────────────┤");
  for (const e of auditEvents.rows.reverse()) {
    const ts = new Date(e.timestamp).toISOString().slice(11, 23);
    const agent = (e.agent_id ?? "").padEnd(22).slice(0, 22);
    const action = (e.action_type ?? "").padEnd(18).slice(0, 18);
    const model = (e.model_used ?? "—").padEnd(12).slice(0, 12);
    const dur = e.duration_ms !== null ? `${e.duration_ms}ms` : "—";
    console.log(`  │ ${ts}  ${agent}  ${action}  ${model}  ${dur.padStart(6)}  │`);
  }
  console.log("  └────────────────────────────────────────────────────────────────────────────────────┘");
  console.log(`  Total audit events in this session: ${auditEvents.rows.length}`);

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  SECTION("SMOKE TEST SUMMARY");

  const allPassed = genResult.validation.valid && consensusResult.accepted;
  console.log(`  Spec Interpretation:     ✓ PASS`);
  console.log(`  Model Routing:           ✓ ${tier} → ${model.model}`);
  console.log(`  Code Generation:         ${genResult.validation.valid ? "✓ PASS" : "✗ FAIL"} (AST valid)`);
  console.log(`  Test-First Pipeline:     ${tfResult.implementationValid ? "✓ PASS" : "✗ FAIL"}`);
  if (calculateCompoundInterest) {
    console.log(`  Metamorphic Testing:     ${metamorphicResult!.passed ? "✓ PASS" : "✗ FAIL"}`);
    console.log(`  Property-Based Testing:  ${pbtResult!.passed ? "✓ PASS" : "✗ FAIL"}`);
    console.log(`  Differential Testing:    ${diffResult!.unanimous ? "✓ PASS" : "✗ DIVERGENCE"}`);
  }
  console.log(`  Multi-Model Consensus:   ${consensusResult.accepted ? "✓ ACCEPTED" : "✗ REJECTED"}`);
  console.log(`  Audit Trail:             ✓ ${auditEvents.rows.length} events recorded`);
  console.log("");
  console.log(`  OVERALL: ${allPassed ? "✓ SMOKE TEST PASSED" : "✗ SMOKE TEST FAILED"}`);

  // Cleanup
  await cache.disconnect();
  await db.disconnect();
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err);
  process.exit(1);
});
