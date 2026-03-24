/**
 * Tests for the Multi-Model Consensus Gate.
 *
 * Verifies:
 * - Queries both cloud and local models for evaluation
 * - Accepts when both agree PASS
 * - Rejects when either says FAIL
 * - Rejects when models disagree
 * - Returns detailed verdicts from each model
 * - Handles model failures gracefully (fail-safe: reject)
 * - Audits the gate decision
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

describe("Multi-Model Consensus Gate", () => {
  let consensus: typeof import("../src/consensus/index.js");
  let db: Awaited<ReturnType<typeof import("../../../foundation/src/db/index.js")["createDbClient"]>>;
  let auditLogger: Awaited<ReturnType<typeof import("../../../foundation/src/audit/index.js")["createAuditLogger"]>>;

  const TEST_AUDIT_PATH = path.resolve(__dirname, "../../../../logs/audit-consensus-test.jsonl");

  beforeAll(async () => {
    const { createDbClient, runMigrations } = await import("../../../foundation/src/db/index.js");
    const { createAuditLogger } = await import("../../../foundation/src/audit/index.js");

    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../../db/migrations"));
    auditLogger = await createAuditLogger({ db, logPath: TEST_AUDIT_PATH });
    consensus = await import("../src/consensus/index.js");
  });

  afterAll(async () => {
    await db.query("DELETE FROM agent_events WHERE agent_id = 'consensus-gate'").catch(() => {});
    const fs = await import("node:fs");
    if (fs.existsSync(TEST_AUDIT_PATH)) fs.unlinkSync(TEST_AUDIT_PATH);
    await db.disconnect();
  });

  describe("Gate logic with mock evaluators", () => {
    it("should accept when both evaluators pass", async () => {
      const gate = consensus.createConsensusGate({
        auditLogger,
        evaluators: [
          { name: "model-a", evaluate: async () => ({ pass: true, reason: "Looks good" }) },
          { name: "model-b", evaluate: async () => ({ pass: true, reason: "All clear" }) },
        ],
      });

      const result = await gate.evaluate("function add(a,b){ return a+b }");
      expect(result.accepted).toBe(true);
      expect(result.verdicts).toHaveLength(2);
      expect(result.verdicts.every(v => v.pass)).toBe(true);
    });

    it("should reject when one evaluator fails", async () => {
      const gate = consensus.createConsensusGate({
        auditLogger,
        evaluators: [
          { name: "model-a", evaluate: async () => ({ pass: true, reason: "OK" }) },
          { name: "model-b", evaluate: async () => ({ pass: false, reason: "Has a bug" }) },
        ],
      });

      const result = await gate.evaluate("function buggy(){ return wrong }");
      expect(result.accepted).toBe(false);
      expect(result.verdicts.some(v => !v.pass)).toBe(true);
    });

    it("should reject when both evaluators fail", async () => {
      const gate = consensus.createConsensusGate({
        auditLogger,
        evaluators: [
          { name: "model-a", evaluate: async () => ({ pass: false, reason: "Bad" }) },
          { name: "model-b", evaluate: async () => ({ pass: false, reason: "Terrible" }) },
        ],
      });

      const result = await gate.evaluate("garbage code");
      expect(result.accepted).toBe(false);
    });

    it("should fail-safe on evaluator error (reject)", async () => {
      const gate = consensus.createConsensusGate({
        auditLogger,
        evaluators: [
          { name: "model-a", evaluate: async () => ({ pass: true, reason: "OK" }) },
          {
            name: "model-crash",
            evaluate: async () => {
              throw new Error("Model unavailable");
            },
          },
        ],
      });

      const result = await gate.evaluate("some code");
      expect(result.accepted).toBe(false);
      expect(result.verdicts.some(v => v.error !== undefined)).toBe(true);
    });
  });

  describe("Live model evaluation", () => {
    it("should evaluate code using local Ollama model", async () => {
      const evaluator = consensus.createOllamaEvaluator({
        name: "ollama-qwen",
        model: "qwen2.5-coder:14b",
        ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      });

      const verdict = await evaluator.evaluate(
        "function add(a: number, b: number): number { return a + b; }"
      );
      expect(verdict.pass).toBeDefined();
      expect(typeof verdict.reason).toBe("string");
    });

    it("should audit the gate decision", async () => {
      const gate = consensus.createConsensusGate({
        auditLogger,
        evaluators: [
          { name: "mock-pass", evaluate: async () => ({ pass: true, reason: "OK" }) },
        ],
      });

      await gate.evaluate("test code");

      const events = await db.query(
        `SELECT * FROM agent_events
         WHERE agent_id = 'consensus-gate'
         ORDER BY timestamp DESC LIMIT 1`
      );
      expect(events.rows.length).toBeGreaterThanOrEqual(1);
    });
  });
});
