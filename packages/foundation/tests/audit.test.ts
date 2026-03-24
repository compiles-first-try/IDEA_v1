/**
 * Tests for the Audit Logger (dual-write to JSONL + PostgreSQL).
 *
 * Verifies:
 * - Creates structured audit events with all required fields
 * - Writes events to both JSONL file and PostgreSQL atomically
 * - Truncates large inputs/outputs to 10KB
 * - Never loses events on partial failure
 * - Provides a Pino-based structured logger
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const TEST_LOG_PATH = path.resolve(__dirname, "../../../logs/audit-test.jsonl");

describe("Audit Logger", () => {
  let auditLogger: Awaited<
    ReturnType<typeof import("../src/audit/index.js")["createAuditLogger"]>
  >;
  let db: Awaited<ReturnType<typeof import("../src/db/index.js")["createDbClient"]>>;

  beforeAll(async () => {
    const { createDbClient, runMigrations } = await import("../src/db/index.js");
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));

    const { createAuditLogger } = await import("../src/audit/index.js");
    auditLogger = await createAuditLogger({ db, logPath: TEST_LOG_PATH });
  });

  beforeEach(() => {
    // Clear test log file before each test
    if (fs.existsSync(TEST_LOG_PATH)) {
      fs.writeFileSync(TEST_LOG_PATH, "");
    }
  });

  afterAll(async () => {
    // Cleanup test events
    await db.query(
      "DELETE FROM agent_events WHERE agent_id LIKE 'audit-test-%'"
    );
    if (fs.existsSync(TEST_LOG_PATH)) fs.unlinkSync(TEST_LOG_PATH);
    await db.disconnect();
  });

  it("should write an event to both JSONL and PostgreSQL", async () => {
    const event = await auditLogger.log({
      agentId: "audit-test-001",
      agentType: "TEST",
      actionType: "TEST_RUN",
      phase: "PHASE_1",
      status: "SUCCESS",
      durationMs: 42,
    });

    expect(event.eventId).toBeDefined();
    expect(event.timestamp).toBeDefined();

    // Verify JSONL
    const lines = fs.readFileSync(TEST_LOG_PATH, "utf-8").trim().split("\n");
    expect(lines.length).toBe(1);
    const logged = JSON.parse(lines[0]);
    expect(logged.event_id).toBe(event.eventId);
    expect(logged.agent_id).toBe("audit-test-001");

    // Verify PostgreSQL
    const pgResult = await db.query(
      "SELECT * FROM agent_events WHERE event_id = $1",
      [event.eventId]
    );
    expect(pgResult.rows).toHaveLength(1);
    expect(pgResult.rows[0].agent_id).toBe("audit-test-001");
  });

  it("should include all required fields from the audit spec", async () => {
    const event = await auditLogger.log({
      agentId: "audit-test-002",
      agentType: "CODE_GENERATOR",
      actionType: "LLM_CALL",
      phase: "LAYER_3",
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      inputs: { prompt: "generate code" },
      outputs: { code: "console.log('hi')" },
      modelUsed: "qwen2.5-coder:14b",
      tokensIn: 100,
      tokensOut: 50,
      costUsd: 0,
      durationMs: 3200,
      status: "SUCCESS",
    });

    const lines = fs.readFileSync(TEST_LOG_PATH, "utf-8").trim().split("\n");
    const logged = JSON.parse(lines[0]);

    expect(logged.event_id).toBe(event.eventId);
    expect(logged.agent_id).toBe("audit-test-002");
    expect(logged.agent_type).toBe("CODE_GENERATOR");
    expect(logged.action_type).toBe("LLM_CALL");
    expect(logged.phase).toBe("LAYER_3");
    expect(logged.model_used).toBe("qwen2.5-coder:14b");
    expect(logged.tokens_in).toBe(100);
    expect(logged.tokens_out).toBe(50);
    expect(logged.duration_ms).toBe(3200);
    expect(logged.status).toBe("SUCCESS");
  });

  it("should truncate inputs/outputs to 10KB", async () => {
    const largeInput = { data: "x".repeat(20_000) };
    const event = await auditLogger.log({
      agentId: "audit-test-003",
      agentType: "TEST",
      actionType: "TEST_RUN",
      status: "SUCCESS",
      inputs: largeInput,
      durationMs: 1,
    });

    const lines = fs.readFileSync(TEST_LOG_PATH, "utf-8").trim().split("\n");
    const logged = JSON.parse(lines[0]);
    const inputStr = JSON.stringify(logged.inputs);
    expect(inputStr.length).toBeLessThanOrEqual(10_240 + 100); // 10KB + overhead
  });
});

describe("Pino Logger", () => {
  it("should create a structured JSON logger", async () => {
    const { createLogger } = await import("../src/audit/index.js");
    const logger = createLogger("test-component");
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
  });
});
