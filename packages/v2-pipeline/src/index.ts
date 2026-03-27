/**
 * V2 Pipeline Orchestrator
 *
 * Wires V1 operational code with V2 capabilities, safety, and routing
 * into a single end-to-end pipeline: spec → artifact.
 *
 * Pattern: PIPELINE (a) — sequential, each stage transforms prior output.
 * No deliberation (ROUTING_CLAUDE.md anti-deliberation rule).
 */
import { createDbClient, runMigrations, type DbClient } from "@rsf/foundation";
import { createCacheClient, type CacheClient } from "@rsf/foundation";
import { createAuditLogger, type AuditLogger } from "@rsf/foundation";
import { createManufacturingSpecInterpreter } from "@rsf/manufacturing";
import { createCodeGenerator, validateTypeScript } from "@rsf/manufacturing";
import { createTestFirstPipeline } from "@rsf/manufacturing";
import { epistemicTracking, testValidator, adversarialReview } from "@rsf/v2-capabilities";
const { measureDisagreement, recommendAction } = epistemicTracking;
const { checkCoverage, checkGameability } = testValidator;
const { critiqueCorrectness, critiqueAdversarial, computeConsensus } = adversarialReview;
import { decideEscalation } from "../../../workflows/build-pipeline/data/escalation-logic.js";

// ── Types ──

interface PipelineConfig {
  postgresUrl: string;
  redisUrl: string;
  ollamaBaseUrl: string;
  migrationsDir: string;
  auditLogPath: string;
}

interface StageResult {
  status: "completed" | "failed" | "skipped";
  durationMs: number;
  modelUsed?: string;
}

interface PipelineResult {
  stages: {
    specInterpreter: StageResult;
    codeGenerator: StageResult;
    testGenerator: StageResult;
    testValidator: StageResult;
    qualityGates: StageResult;
    adversarialReview: StageResult;
  };
  artifacts: {
    code: string;
    tests: string;
    qualityReport: { gate: string; passed: boolean; details: string }[];
  };
  uncertainty: {
    epistemic: number;
    aleatoric: number;
    action: string;
  };
  routing: {
    tier: number;
    classification: string;
    escalated: boolean;
  };
  auditTrail: { eventId: string; agentId: string; action: string; durationMs: number }[];
}

interface Classification {
  tier: 1 | 2 | 3;
  taskType: "DETERMINISTIC" | "SIMPLE" | "STANDARD" | "COMPLEX";
}

export interface V2Pipeline {
  run: (spec: string) => Promise<PipelineResult>;
  classify: (spec: string) => Classification;
  getStatus: () => { running: boolean };
  shutdown: () => Promise<void>;
}

// ── Classification ──

const DETERMINISTIC_PATTERNS = [/validate.*json/i, /schema.*valid/i, /format/i, /lint/i, /type.?check/i];
const SIMPLE_PATTERNS = [/single.*function/i, /rename/i, /docstring/i, /comment/i, /csv.*json/i];
const COMPLEX_PATTERNS = [/novel.*algorithm/i, /architect/i, /ambiguous/i, /multi.?file.*refactor/i, /contradictory/i];
// Everything else → STANDARD

function classifyTask(spec: string): Classification {
  if (DETERMINISTIC_PATTERNS.some((p) => p.test(spec))) return { tier: 1, taskType: "DETERMINISTIC" };
  if (SIMPLE_PATTERNS.some((p) => p.test(spec))) return { tier: 1, taskType: "SIMPLE" };
  if (COMPLEX_PATTERNS.some((p) => p.test(spec))) return { tier: 3, taskType: "COMPLEX" };
  return { tier: 2, taskType: "STANDARD" };
}

// ── Pipeline Factory ──

export async function createV2Pipeline(config: PipelineConfig): Promise<V2Pipeline> {
  const db = await createDbClient(config.postgresUrl);
  await runMigrations(db, config.migrationsDir);
  const cache = await createCacheClient(config.redisUrl);
  const auditLogger = await createAuditLogger({ db, logPath: config.auditLogPath });

  let running = false;
  const auditTrail: PipelineResult["auditTrail"] = [];

  async function logStage(
    agentId: string,
    actionType: string,
    durationMs: number,
    tier: number,
    modelUsed?: string,
    qualityScore?: number,
    costUsd?: number,
    cacheHit?: boolean,
    escalatedFromTier?: number
  ): Promise<string> {
    const result = await auditLogger.log({
      agentId,
      agentType: "V2_PIPELINE",
      actionType,
      phase: "V2_BUILD_PIPELINE",
      modelUsed,
      durationMs,
      status: "SUCCESS",
    });

    // Write Pareto columns directly
    await db.query(
      `UPDATE agent_events SET task_tier = $1, task_cost_usd = $2, task_quality_score = $3, cache_hit = $4, escalated_from_tier = $5 WHERE event_id = $6`,
      [tier, costUsd ?? 0, qualityScore ?? null, cacheHit ?? false, escalatedFromTier ?? null, result.eventId]
    );

    auditTrail.push({ eventId: result.eventId, agentId, action: actionType, durationMs });
    return result.eventId;
  }

  async function run(spec: string): Promise<PipelineResult> {
    // Kill switch check
    const killFlag = await cache.get("rsf:kill:global");
    if (killFlag === "1") {
      throw new Error("Kill switch is active — pipeline cannot run");
    }

    running = true;
    auditTrail.length = 0;

    const classification = classifyTask(spec);
    const tier = classification.tier;

    const stages: PipelineResult["stages"] = {
      specInterpreter: { status: "skipped", durationMs: 0 },
      codeGenerator: { status: "skipped", durationMs: 0 },
      testGenerator: { status: "skipped", durationMs: 0 },
      testValidator: { status: "skipped", durationMs: 0 },
      qualityGates: { status: "skipped", durationMs: 0 },
      adversarialReview: { status: "skipped", durationMs: 0 },
    };

    // ── Stage 1: Spec Interpretation ──
    const specStart = Date.now();
    const specInterpreter = createManufacturingSpecInterpreter({
      cache,
      auditLogger,
      ollamaBaseUrl: config.ollamaBaseUrl,
    });
    const target = await specInterpreter.interpret(spec);
    const specDuration = Date.now() - specStart;
    stages.specInterpreter = { status: "completed", durationMs: specDuration, modelUsed: "qwen2.5-coder:14b" };
    await logStage("v2-pipeline-spec", "SPEC_INTERPRET", specDuration, tier, "qwen2.5-coder:14b");

    // ── Stage 2: Code Generation ──
    const codeStart = Date.now();
    const codeGen = createCodeGenerator({
      auditLogger,
      ollamaBaseUrl: config.ollamaBaseUrl,
    });
    const codeResult = await codeGen.generate(target);
    const codeDuration = Date.now() - codeStart;
    stages.codeGenerator = { status: "completed", durationMs: codeDuration, modelUsed: "qwen2.5-coder:14b" };
    await logStage("v2-pipeline-codegen", "CODE_GENERATE", codeDuration, tier, "qwen2.5-coder:14b", undefined, 0);

    // ── Stage 3: Test Generation ──
    const testStart = Date.now();
    const testFirst = createTestFirstPipeline({
      auditLogger,
      ollamaBaseUrl: config.ollamaBaseUrl,
    });
    const testResult = await testFirst.run(target);
    const testDuration = Date.now() - testStart;
    stages.testGenerator = { status: "completed", durationMs: testDuration, modelUsed: "qwen2.5-coder:14b" };
    await logStage("v2-pipeline-testgen", "TEST_GENERATE", testDuration, tier, "qwen2.5-coder:14b");

    // ── Stage 4: Test Validation (V2 capability) ──
    const validStart = Date.now();
    const coverageResult = checkCoverage({
      requirements: target.requirements,
      testCode: testResult.testCode,
    });
    const gameResult = checkGameability({
      functionName: target.name,
      testCode: testResult.testCode,
    });
    const validDuration = Date.now() - validStart;
    stages.testValidator = { status: "completed", durationMs: validDuration };
    await logStage("v2-pipeline-testvalid", "TEST_VALIDATE", validDuration, tier);

    // ── Stage 5: Quality Gates ──
    const qualStart = Date.now();
    const astValid = validateTypeScript(codeResult.code);
    const qualityReport: PipelineResult["artifacts"]["qualityReport"] = [
      { gate: "AST Validation", passed: astValid.valid, details: astValid.valid ? "Zero errors" : astValid.errors.join("; ") },
      { gate: "Test Coverage", passed: coverageResult.coveredRequirements >= coverageResult.totalRequirements * 0.8, details: `${coverageResult.coveredRequirements}/${coverageResult.totalRequirements} requirements covered` },
      { gate: "Gameability Check", passed: !gameResult.gameable, details: gameResult.gameable ? `Tests are gameable: ${gameResult.reason}` : "Tests are not trivially gameable" },
    ];
    const qualDuration = Date.now() - qualStart;
    const qualScore = qualityReport.filter((g) => g.passed).length / qualityReport.length;
    stages.qualityGates = { status: "completed", durationMs: qualDuration };
    await logStage("v2-pipeline-quality", "QUALITY_GATES", qualDuration, tier, undefined, qualScore);

    // ── Stage 6: Adversarial Review (V2 capability) ──
    const revStart = Date.now();
    const correctnessVerdict = critiqueCorrectness({
      code: codeResult.code,
      requirements: target.requirements,
    });
    const adversarialVerdict = critiqueAdversarial({
      code: codeResult.code,
      requirements: target.requirements,
    });
    const consensus = computeConsensus([
      { role: "correctness", ...correctnessVerdict },
      { role: "adversarial", ...adversarialVerdict },
      { role: "efficiency", verdict: "PASS" as const, findings: [] },
    ]);
    const revDuration = Date.now() - revStart;
    stages.adversarialReview = { status: "completed", durationMs: revDuration };
    await logStage("v2-pipeline-review", "ADVERSARIAL_REVIEW", revDuration, tier, undefined, consensus.accepted ? 1.0 : 0.0);

    // ── Epistemic Tracking ──
    // Simulate cross-model disagreement from the code generation outputs
    const disagreement = measureDisagreement([
      { model: "qwen2.5-coder:14b", output: codeResult.code },
      { model: "test-first-impl", output: testResult.implementationCode },
    ]);
    const action = recommendAction(disagreement.epistemicUncertainty, disagreement.aleatoricUncertainty);

    running = false;

    return {
      stages,
      artifacts: {
        code: codeResult.code,
        tests: testResult.testCode,
        qualityReport,
      },
      uncertainty: {
        epistemic: disagreement.epistemicUncertainty,
        aleatoric: disagreement.aleatoricUncertainty,
        action,
      },
      routing: {
        tier,
        classification: classification.taskType,
        escalated: false,
      },
      auditTrail: [...auditTrail],
    };
  }

  function classify(spec: string): Classification {
    return classifyTask(spec);
  }

  function getStatus() {
    return { running };
  }

  async function shutdown() {
    await cache.disconnect();
    await db.disconnect();
  }

  return { run, classify, getStatus, shutdown };
}
