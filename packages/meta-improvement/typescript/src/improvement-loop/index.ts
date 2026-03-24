import type { AuditLogger } from "@rsf/foundation";

/**
 * Protected components that the improvement loop must NEVER modify.
 * These require human review before any changes.
 */
const PROTECTED_PATTERNS = [
  "kill-switch",
  "kill_switch",
  "audit",
  "secrets",
  "router",
  "scripts/gate1",
  "scripts/gate2",
  "scripts/gate3",
  "scripts/gate4",
  "scripts/gate5",
  "scripts/kill-switch",
] as const;

/**
 * Check if a component path or name is protected from automated modification.
 */
export function isProtectedComponent(componentPath: string): boolean {
  const normalized = componentPath.toLowerCase();
  return PROTECTED_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export interface MeasureResult {
  score: number;
  metrics: Record<string, unknown>;
}

export interface Proposal {
  targetComponent: string;
  description: string;
  proposedChange: string;
}

export interface TestResult {
  score: number;
  testsPassed: number;
  testsFailed: number;
}

export interface GateDecision {
  accepted: boolean;
  reason: string;
}

export interface ApplyResult {
  version: number;
  appliedAt: string;
}

export type CycleStatus = "APPLIED" | "REJECTED" | "BLOCKED_PROTECTED" | "ERROR";

export interface CycleResult {
  status: CycleStatus;
  beforeScore: number;
  afterScore: number;
  proposal: Proposal | null;
  reason: string;
}

interface ImprovementCycleDeps {
  auditLogger: AuditLogger;
  measure: () => Promise<MeasureResult>;
  propose: (metrics: MeasureResult) => Promise<Proposal>;
  test: (proposal: Proposal) => Promise<TestResult>;
  gate: (currentScore: number, proposedScore: number) => Promise<GateDecision>;
  apply: (proposal: Proposal) => Promise<ApplyResult>;
}

export interface ImprovementCycle {
  run: () => Promise<CycleResult>;
}

/**
 * Create an improvement cycle orchestrator.
 *
 * Implements the full loop: measure → propose → test → gate → apply → record
 *
 * Strict constraints:
 * - NEVER modifies protected components (kill switch, audit, secrets, router guardrails, gate scripts)
 * - Only applies improvements that pass the consensus gate
 * - Records full lineage of changes
 */
export function createImprovementCycle(
  deps: ImprovementCycleDeps
): ImprovementCycle {
  const { auditLogger, measure, propose, test, gate, apply } = deps;

  async function audit(actionType: string, inputs: Record<string, unknown>, status: string): Promise<void> {
    await auditLogger.log({
      agentId: "improvement-loop",
      agentType: "META_IMPROVEMENT",
      actionType,
      phase: "LAYER_6_META_IMPROVEMENT",
      inputs,
      status: status as "SUCCESS" | "FAILURE",
      durationMs: 0,
    });
  }

  async function run(): Promise<CycleResult> {
    // Step 1: MEASURE
    const measurement = await measure();
    await audit("MEASURE", { score: measurement.score }, "SUCCESS");

    // Step 2: PROPOSE
    let proposal: Proposal;
    try {
      proposal = await propose(measurement);
      await audit("PROPOSE", {
        target: proposal.targetComponent,
        description: proposal.description,
      }, "SUCCESS");
    } catch (err) {
      await audit("PROPOSE", { error: String(err) }, "FAILURE");
      return {
        status: "ERROR",
        beforeScore: measurement.score,
        afterScore: measurement.score,
        proposal: null,
        reason: `Proposal failed: ${err}`,
      };
    }

    // Step 2.5: PROTECTION CHECK
    if (isProtectedComponent(proposal.targetComponent)) {
      await audit("BLOCKED", {
        target: proposal.targetComponent,
        reason: "Protected component — requires human review",
      }, "FAILURE");
      return {
        status: "BLOCKED_PROTECTED",
        beforeScore: measurement.score,
        afterScore: measurement.score,
        proposal,
        reason: `Component ${proposal.targetComponent} is protected and cannot be modified by the improvement loop`,
      };
    }

    // Step 3: TEST in isolation
    let testResult: TestResult;
    try {
      testResult = await test(proposal);
      await audit("TEST", {
        score: testResult.score,
        passed: testResult.testsPassed,
        failed: testResult.testsFailed,
      }, "SUCCESS");
    } catch (err) {
      await audit("TEST", { error: String(err) }, "FAILURE");
      return {
        status: "ERROR",
        beforeScore: measurement.score,
        afterScore: measurement.score,
        proposal,
        reason: `Testing failed: ${err}`,
      };
    }

    // Step 4: GATE — must be measurably better
    const gateDecision = await gate(measurement.score, testResult.score);
    await audit("GATE", {
      currentScore: measurement.score,
      proposedScore: testResult.score,
      accepted: gateDecision.accepted,
      reason: gateDecision.reason,
    }, gateDecision.accepted ? "SUCCESS" : "FAILURE");

    if (!gateDecision.accepted) {
      return {
        status: "REJECTED",
        beforeScore: measurement.score,
        afterScore: testResult.score,
        proposal,
        reason: gateDecision.reason,
      };
    }

    // Step 5: APPLY
    try {
      const applyResult = await apply(proposal);
      await audit("APPLY", {
        version: applyResult.version,
        appliedAt: applyResult.appliedAt,
      }, "SUCCESS");
    } catch (err) {
      await audit("APPLY", { error: String(err) }, "FAILURE");
      return {
        status: "ERROR",
        beforeScore: measurement.score,
        afterScore: testResult.score,
        proposal,
        reason: `Apply failed: ${err}`,
      };
    }

    // Step 6: RECORD
    await audit("RECORD", {
      beforeScore: measurement.score,
      afterScore: testResult.score,
      target: proposal.targetComponent,
      description: proposal.description,
    }, "SUCCESS");

    return {
      status: "APPLIED",
      beforeScore: measurement.score,
      afterScore: testResult.score,
      proposal,
      reason: "Improvement applied successfully",
    };
  }

  return { run };
}
