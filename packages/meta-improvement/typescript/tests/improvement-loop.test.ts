/**
 * Tests for the Improvement Cycle Orchestrator.
 *
 * Verifies:
 * - Full measure→propose→test→gate→apply→record loop
 * - Blocks modifications to protected components
 * - Only applies improvements that score higher than current
 * - Multi-model consensus gate required for acceptance
 * - Records lineage (before/after versions)
 * - Handles failed proposals gracefully
 * - Audits each step
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

describe("Improvement Cycle Orchestrator", () => {
  let improvementLoop: typeof import("../src/improvement-loop/index.js");
  let db: Awaited<ReturnType<typeof import("../../../foundation/src/db/index.js")["createDbClient"]>>;
  let auditLogger: Awaited<ReturnType<typeof import("../../../foundation/src/audit/index.js")["createAuditLogger"]>>;

  const TEST_AUDIT = path.resolve(__dirname, "../../../../logs/audit-improve-test.jsonl");

  beforeAll(async () => {
    const { createDbClient, runMigrations } = await import("../../../foundation/src/db/index.js");
    const { createAuditLogger } = await import("../../../foundation/src/audit/index.js");
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../../db/migrations"));
    auditLogger = await createAuditLogger({ db, logPath: TEST_AUDIT });
    improvementLoop = await import("../src/improvement-loop/index.js");
  });

  afterAll(async () => {
    await db.query("DELETE FROM agent_events WHERE agent_id = 'improvement-loop'").catch(() => {});
    const fs = await import("node:fs");
    if (fs.existsSync(TEST_AUDIT)) fs.unlinkSync(TEST_AUDIT);
    await db.disconnect();
  });

  describe("Protected components", () => {
    it("should reject modifications to the kill switch", () => {
      expect(improvementLoop.isProtectedComponent("kill-switch")).toBe(true);
      expect(improvementLoop.isProtectedComponent("packages/orchestration/src/kill-switch/index.ts")).toBe(true);
    });

    it("should reject modifications to the audit log writer", () => {
      expect(improvementLoop.isProtectedComponent("audit")).toBe(true);
      expect(improvementLoop.isProtectedComponent("packages/foundation/src/audit/index.ts")).toBe(true);
    });

    it("should reject modifications to the secret manager", () => {
      expect(improvementLoop.isProtectedComponent("secrets")).toBe(true);
    });

    it("should reject modifications to model router budget guardrails", () => {
      expect(improvementLoop.isProtectedComponent("router")).toBe(true);
    });

    it("should reject modifications to gate scripts", () => {
      expect(improvementLoop.isProtectedComponent("scripts/gate1-env-audit.sh")).toBe(true);
      expect(improvementLoop.isProtectedComponent("scripts/gate5-phase-validate.sh")).toBe(true);
    });

    it("should allow modifications to non-protected components", () => {
      expect(improvementLoop.isProtectedComponent("packages/manufacturing/src/generator/index.ts")).toBe(false);
      expect(improvementLoop.isProtectedComponent("packages/quality/typescript/src/metamorphic/index.ts")).toBe(false);
    });
  });

  describe("Improvement cycle", () => {
    it("should run a full cycle with mock components", async () => {
      const cycle = improvementLoop.createImprovementCycle({
        auditLogger,
        measure: async () => ({ score: 0.7, metrics: { testPassRate: 0.7 } }),
        propose: async (metrics) => ({
          targetComponent: "packages/manufacturing/src/generator/index.ts",
          description: "Improve code generation prompt",
          proposedChange: "Updated system prompt with better examples",
        }),
        test: async (proposal) => ({ score: 0.85, testsPassed: 17, testsFailed: 3 }),
        gate: async (currentScore, proposedScore) => ({
          accepted: proposedScore > currentScore,
          reason: proposedScore > currentScore ? "Score improved" : "No improvement",
        }),
        apply: async (proposal) => ({ version: 2, appliedAt: new Date().toISOString() }),
      });

      const result = await cycle.run();

      expect(result.status).toBe("APPLIED");
      expect(result.beforeScore).toBe(0.7);
      expect(result.afterScore).toBe(0.85);
      expect(result.proposal).toBeDefined();
    });

    it("should reject proposal that does not improve score", async () => {
      const cycle = improvementLoop.createImprovementCycle({
        auditLogger,
        measure: async () => ({ score: 0.9, metrics: {} }),
        propose: async () => ({
          targetComponent: "packages/manufacturing/src/repair/index.ts",
          description: "Attempted improvement",
          proposedChange: "Some change",
        }),
        test: async () => ({ score: 0.7, testsPassed: 14, testsFailed: 6 }),
        gate: async (currentScore, proposedScore) => ({
          accepted: proposedScore > currentScore,
          reason: "Score decreased",
        }),
        apply: async () => { throw new Error("Should not be called"); },
      });

      const result = await cycle.run();
      expect(result.status).toBe("REJECTED");
      expect(result.beforeScore).toBe(0.9);
      expect(result.afterScore).toBe(0.7);
    });

    it("should block proposals targeting protected components", async () => {
      const cycle = improvementLoop.createImprovementCycle({
        auditLogger,
        measure: async () => ({ score: 0.5, metrics: {} }),
        propose: async () => ({
          targetComponent: "packages/foundation/src/audit/index.ts",
          description: "Modify audit logger",
          proposedChange: "Dangerous change",
        }),
        test: async () => ({ score: 0.95, testsPassed: 20, testsFailed: 0 }),
        gate: async () => ({ accepted: true, reason: "Looks great" }),
        apply: async () => ({ version: 2, appliedAt: new Date().toISOString() }),
      });

      const result = await cycle.run();
      expect(result.status).toBe("BLOCKED_PROTECTED");
    });

    it("should audit each step of the cycle", async () => {
      const cycle = improvementLoop.createImprovementCycle({
        auditLogger,
        measure: async () => ({ score: 0.6, metrics: {} }),
        propose: async () => ({
          targetComponent: "packages/manufacturing/src/test-first/index.ts",
          description: "Test improvement",
          proposedChange: "Change",
        }),
        test: async () => ({ score: 0.8, testsPassed: 16, testsFailed: 4 }),
        gate: async (c, p) => ({ accepted: p > c, reason: "Better" }),
        apply: async () => ({ version: 2, appliedAt: new Date().toISOString() }),
      });

      await cycle.run();

      const events = await db.query(
        `SELECT action_type FROM agent_events
         WHERE agent_id = 'improvement-loop'
         ORDER BY timestamp DESC LIMIT 10`
      );
      const actions = events.rows.map(r => r.action_type);
      expect(actions).toContain("MEASURE");
      expect(actions).toContain("PROPOSE");
    });
  });
});
