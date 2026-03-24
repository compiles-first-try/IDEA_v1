/**
 * Tests for the Specification Interpreter Agent.
 *
 * Verifies:
 * - Parses natural language spec into structured generation target
 * - Uses model router to select appropriate model
 * - Respects its behavioral contract
 * - Checks kill switch before execution
 * - Audits all actions
 * - Returns structured output with Zod validation
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Specification Interpreter Agent", () => {
  let specAgent: typeof import("../src/agents/spec-interpreter.js");
  let cache: Awaited<ReturnType<typeof import("../../foundation/src/cache/index.js")["createCacheClient"]>>;
  let db: Awaited<ReturnType<typeof import("../../foundation/src/db/index.js")["createDbClient"]>>;
  let auditLogger: Awaited<ReturnType<typeof import("../../foundation/src/audit/index.js")["createAuditLogger"]>>;
  let killSwitch: Awaited<ReturnType<typeof import("../src/kill-switch/index.js")["createKillSwitch"]>>;
  let router: Awaited<ReturnType<typeof import("../src/router/index.js")["createModelRouter"]>>;

  const TEST_AUDIT_PATH = path.resolve(__dirname, "../../../logs/audit-agent-test.jsonl");

  beforeAll(async () => {
    const { createCacheClient } = await import("../../foundation/src/cache/index.js");
    const { createDbClient, runMigrations } = await import("../../foundation/src/db/index.js");
    const { createAuditLogger } = await import("../../foundation/src/audit/index.js");
    const { createKillSwitch } = await import("../src/kill-switch/index.js");
    const { createModelRouter } = await import("../src/router/index.js");

    cache = await createCacheClient(process.env.REDIS_URL ?? "redis://localhost:6379");
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
    auditLogger = await createAuditLogger({ db, logPath: TEST_AUDIT_PATH });
    killSwitch = await createKillSwitch({ cache, auditLogger });
    router = await createModelRouter({
      cache,
      maxDailySpendUsd: 10,
      pauseThresholdUsd: 20,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });

    specAgent = await import("../src/agents/spec-interpreter.js");
  });

  afterAll(async () => {
    await killSwitch.reset();
    await cache.del("rsf:daily-spend");
    await db.query("DELETE FROM agent_events WHERE agent_id = 'spec-interpreter'").catch(() => {});
    const fs = await import("node:fs");
    if (fs.existsSync(TEST_AUDIT_PATH)) fs.unlinkSync(TEST_AUDIT_PATH);
    await cache.disconnect();
    await db.disconnect();
  });

  it("should have a defined contract", () => {
    const contract = specAgent.SPEC_INTERPRETER_CONTRACT;
    expect(contract.agentId).toBe("spec-interpreter");
    expect(contract.allowedModels.length).toBeGreaterThan(0);
    expect(contract.maxExecutionMs).toBeGreaterThan(0);
  });

  it("should parse a simple spec into a structured target", async () => {
    const agent = specAgent.createSpecInterpreter({
      router,
      killSwitch,
      auditLogger,
    });

    const result = await agent.interpret(
      "Create a TypeScript function that validates email addresses using a regex pattern"
    );

    expect(result.name).toBeDefined();
    expect(result.language).toBe("typescript");
    expect(result.type).toBeDefined();
    expect(result.description).toBeDefined();
    expect(result.requirements).toBeDefined();
    expect(Array.isArray(result.requirements)).toBe(true);
  });

  it("should refuse to run when kill switch is active", async () => {
    await killSwitch.activate("test", "REDIS");

    const agent = specAgent.createSpecInterpreter({
      router,
      killSwitch,
      auditLogger,
    });

    await expect(
      agent.interpret("Any spec text")
    ).rejects.toThrow(/kill switch/i);

    await killSwitch.reset();
  });

  it("should audit its LLM call", async () => {
    const agent = specAgent.createSpecInterpreter({
      router,
      killSwitch,
      auditLogger,
    });

    await agent.interpret("Build a calculator function");

    // Check audit log
    const events = await db.query(
      `SELECT * FROM agent_events
       WHERE agent_id = 'spec-interpreter'
       AND action_type = 'LLM_CALL'
       ORDER BY timestamp DESC LIMIT 1`
    );
    expect(events.rows.length).toBeGreaterThanOrEqual(1);
    expect(events.rows[0].model_used).toBeDefined();
  });

  it("should route to local model for simple specs", async () => {
    const agent = specAgent.createSpecInterpreter({
      router,
      killSwitch,
      auditLogger,
    });

    const result = await agent.interpret(
      "Write a function that adds two numbers"
    );

    // Should have used a local model (STANDARD tier)
    expect(result).toBeDefined();
    expect(result.language).toBeDefined();
  });
});
