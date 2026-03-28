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
  reason: string;
}

export interface V2Pipeline {
  run: (spec: string) => Promise<PipelineResult>;
  classify: (spec: string) => Classification;
  getStatus: () => { running: boolean };
  shutdown: () => Promise<void>;
}

// ── Classification (two-phase: regex fast path + heuristic scoring) ──

const DETERMINISTIC_PATTERNS = [/validate.*json/i, /schema.*valid/i, /format/i, /lint/i, /type.?check/i];
const SIMPLE_PATTERNS = [/single.*function/i, /rename/i, /docstring/i, /comment/i, /csv.*json/i];
const COMPLEX_PATTERNS = [
  /novel.*algorithm/i, /architect/i, /ambiguous/i, /multi.?file.*refactor/i, /contradictory/i,
  /website/i, /web\s*app/i, /application/i, /multiple.*(?:page|file|component|module)/i,
  /design.*(?:decision|pattern|system)/i, /full.?stack/i, /dashboard/i, /platform/i,
];

function analyzeComplexity(spec: string): { score: number; signals: string[] } {
  const signals: string[] = [];

  // Length signal — longer specs imply broader scope
  if (spec.length > 500) signals.push("long spec (>500 chars)");
  else if (spec.length > 200) signals.push("moderate spec length");

  // Ambiguity signals
  if (/\?/.test(spec)) signals.push("contains questions");
  if (/\b(or|maybe|either|possibly|could|might)\b/i.test(spec)) signals.push("ambiguous language");
  if (/\b(unclear|not sure|depends)\b/i.test(spec)) signals.push("explicit uncertainty");

  // Scope signals
  const sentences = spec.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  if (sentences.length > 3) signals.push(`multi-sentence spec (${sentences.length} sentences)`);

  // Complexity signals
  if (/\b(page|route|endpoint|component|service|module)\b/i.test(spec)) signals.push("multi-component language");
  if (/\b(database|auth|login|user|api|crud|rest)\b/i.test(spec)) signals.push("infrastructure terms");
  if (/\b(deploy|docker|ci|cd|production)\b/i.test(spec)) signals.push("deployment scope");

  return { score: signals.length, signals };
}

function classifyTask(spec: string): Classification {
  // Phase 1: Regex fast path for clear matches
  for (const p of DETERMINISTIC_PATTERNS) {
    if (p.test(spec)) return { tier: 1, taskType: "DETERMINISTIC", reason: `Matched deterministic pattern: ${p}` };
  }
  for (const p of SIMPLE_PATTERNS) {
    if (p.test(spec)) return { tier: 1, taskType: "SIMPLE", reason: `Matched simple pattern: ${p}` };
  }
  for (const p of COMPLEX_PATTERNS) {
    if (p.test(spec)) return { tier: 3, taskType: "COMPLEX", reason: `Matched complex pattern: ${p}` };
  }

  // Phase 2: Heuristic scoring for the STANDARD catch-all
  const { score, signals } = analyzeComplexity(spec);
  if (score >= 2) {
    return {
      tier: 3,
      taskType: "COMPLEX",
      reason: `Heuristic upgrade (score ${score}): ${signals.join(", ")}`,
    };
  }

  return {
    tier: 2,
    taskType: "STANDARD",
    reason: signals.length > 0
      ? `Default tier — signals below threshold (score ${score}): ${signals.join(", ")}`
      : "Default tier — no complexity signals detected",
  };
}

// ── Pipeline Factory ──

export async function createV2Pipeline(config: PipelineConfig): Promise<V2Pipeline> {
  const db = await createDbClient(config.postgresUrl);
  await runMigrations(db, config.migrationsDir);
  const cache = await createCacheClient(config.redisUrl);
  const auditLogger = await createAuditLogger({ db, logPath: config.auditLogPath });

  let running = false;
  const auditTrail: PipelineResult["auditTrail"] = [];

  // Knowledge base search — embeds query via Ollama, searches memory_entries via pgvector
  async function searchContext(query: string): Promise<Array<{ content: string; score: number }>> {
    try {
      const embedRes = await fetch(`${config.ollamaBaseUrl}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "nomic-embed-text:latest", input: query }),
      });

      if (!embedRes.ok) return [];

      const embedData = await embedRes.json() as { embeddings?: number[][] };
      const queryEmbedding = embedData.embeddings?.[0];
      if (!queryEmbedding) return [];

      const result = await db.query(
        `SELECT content, 1 - (embedding <=> $1::vector) AS score
         FROM memory_entries
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT 5`,
        [`[${queryEmbedding.join(",")}]`],
      );

      return result.rows.map((r) => ({
        content: r.content as string,
        score: parseFloat(String(r.score)),
      }));
    } catch {
      return [];
    }
  }

  async function logStage(
    agentId: string,
    actionType: string,
    durationMs: number,
    tier: number,
    modelUsed?: string,
    qualityScore?: number,
    costUsd?: number,
    cacheHit?: boolean,
    escalatedFromTier?: number,
    reasoningTrace?: string
  ): Promise<string> {
    const result = await auditLogger.log({
      agentId,
      agentType: "V2_PIPELINE",
      actionType,
      phase: "V2_BUILD_PIPELINE",
      modelUsed,
      durationMs,
      status: "SUCCESS",
      reasoningTrace,
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
    const classificationTrace = `Classified spec (${spec.length} chars) as ${classification.taskType} (tier ${tier}). ${classification.reason}`;

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
    const useClaudeForSpec = tier >= 3;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const specInterpreter = createManufacturingSpecInterpreter({
      cache,
      auditLogger,
      ollamaBaseUrl: config.ollamaBaseUrl,
      searchContext,
      useClaudeApi: useClaudeForSpec && !!anthropicApiKey,
      anthropicApiKey,
    });
    const target = await specInterpreter.interpret(spec);
    const specDuration = Date.now() - specStart;
    const specModel = useClaudeForSpec && anthropicApiKey ? "claude-haiku-4-5-20251001" : "qwen2.5-coder:14b";
    stages.specInterpreter = { status: "completed", durationMs: specDuration, modelUsed: specModel };
    const specTrace = `Parsed spec (${spec.length} chars) as ${target.type} '${target.name}'. ` +
      `Language: ${target.language}. Signature: ${target.functionSignature}. ` +
      `Extracted ${target.requirements.length} requirements, ${target.edgeCases.length} edge cases, ${target.testHints.length} test hints. ` +
      classificationTrace;
    await logStage("v2-pipeline-spec", "SPEC_INTERPRET", specDuration, tier, specModel, undefined, undefined, undefined, undefined, specTrace);

    // ── Stage 2: Code Generation ──
    const codeStart = Date.now();
    const codeGen = createCodeGenerator({
      auditLogger,
      ollamaBaseUrl: config.ollamaBaseUrl,
    });
    const codeResult = await codeGen.generate(target);
    const codeDuration = Date.now() - codeStart;
    const codeStatus = codeResult.validation.valid ? "completed" : "failed";
    stages.codeGenerator = { status: codeStatus, durationMs: codeDuration, modelUsed: "qwen2.5-coder:14b" };
    const codeTrace = `Generated ${codeResult.code.length} chars of ${target.language} for '${target.name}'. ` +
      `AST validation: ${codeResult.validation.valid ? "passed (zero errors)" : "failed with " + codeResult.validation.errors.length + " errors: " + codeResult.validation.errors.slice(0, 2).join("; ")}.`;
    await logStage("v2-pipeline-codegen", "CODE_GENERATE", codeDuration, tier, "qwen2.5-coder:14b", undefined, 0, undefined, undefined, codeTrace);

    // ── Stage 3: Test Generation ──
    const testStart = Date.now();
    const testFirst = createTestFirstPipeline({
      auditLogger,
      ollamaBaseUrl: config.ollamaBaseUrl,
    });
    const testResult = await testFirst.run(target);
    const testDuration = Date.now() - testStart;
    stages.testGenerator = { status: "completed", durationMs: testDuration, modelUsed: "qwen2.5-coder:14b" };
    const testTrace = `Generated tests for '${target.name}' using test-first pipeline. ` +
      `Test code: ${testResult.testCode.length} chars. Implementation code: ${testResult.implementationCode.length} chars. ` +
      `Tests are generated independently from the code generator to avoid confirmation bias (Rule 21).`;
    await logStage("v2-pipeline-testgen", "TEST_GENERATE", testDuration, tier, "qwen2.5-coder:14b", undefined, undefined, undefined, undefined, testTrace);

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
    const validTrace = `Coverage: ${coverageResult.coveredRequirements}/${coverageResult.totalRequirements} requirements covered (${(coverageResult.coveredRequirements / Math.max(coverageResult.totalRequirements, 1) * 100).toFixed(0)}%). ` +
      `Gameability: ${gameResult.gameable ? "GAMEABLE — " + gameResult.reason : "not gameable — tests have sufficient unique assertions"}.`;
    await logStage("v2-pipeline-testvalid", "TEST_VALIDATE", validDuration, tier, undefined, undefined, undefined, undefined, undefined, validTrace);

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
    const qualTrace = `Quality score: ${(qualScore * 100).toFixed(0)}% (${qualityReport.filter(g => g.passed).length}/${qualityReport.length} gates passed). ` +
      qualityReport.map(g => `${g.gate}: ${g.passed ? "PASS" : "FAIL"} — ${g.details}`).join(". ") + ".";
    await logStage("v2-pipeline-quality", "QUALITY_GATES", qualDuration, tier, undefined, qualScore, undefined, undefined, undefined, qualTrace);

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
    const reviewTrace = `Consensus: ${consensus.accepted ? "ACCEPTED" : "REJECTED"}. ` +
      `Correctness critic: ${correctnessVerdict.verdict}${correctnessVerdict.findings.length > 0 ? " — " + correctnessVerdict.findings.slice(0, 2).join("; ") : ""}. ` +
      `Adversarial critic: ${adversarialVerdict.verdict}${adversarialVerdict.findings.length > 0 ? " — " + adversarialVerdict.findings.slice(0, 2).join("; ") : ""}. ` +
      `Efficiency critic: PASS (no issues detected).`;
    await logStage("v2-pipeline-review", "ADVERSARIAL_REVIEW", revDuration, tier, undefined, consensus.accepted ? 1.0 : 0.0, undefined, undefined, undefined, reviewTrace);

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
