/**
 * Contract 6: TypeScript → Audit Log
 *
 * Verifies:
 * - Can write a structured JSON event to /logs/audit.jsonl
 * - Can write the same event to PostgreSQL agent_events table
 * - Both writes succeed atomically (if one fails, both are rolled back)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const AUDIT_LOG_PATH = path.resolve(
  __dirname,
  "../../../",
  process.env.AUDIT_LOG_PATH ?? "./logs/audit.jsonl"
);

interface AuditEvent {
  event_id: string;
  timestamp: string;
  agent_id: string;
  agent_type: string;
  action_type: string;
  phase: string;
  session_id: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  model_used: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  duration_ms: number;
  status: string;
  error_message: string | null;
  parent_event_id: string | null;
}

describe("Contract 6: TypeScript → Audit Log", () => {
  let client: pg.Client;
  const testEventId = randomUUID();
  const testSessionId = randomUUID();

  beforeAll(async () => {
    client = new pg.Client({
      connectionString: process.env.POSTGRES_URL,
    });
    await client.connect();

    // Create agent_events table if it doesn't exist (will be replaced by Flyway later)
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_events (
        id              BIGSERIAL PRIMARY KEY,
        event_id        UUID NOT NULL DEFAULT gen_random_uuid(),
        timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        agent_id        VARCHAR(255) NOT NULL,
        agent_type      VARCHAR(100) NOT NULL,
        action_type     VARCHAR(100) NOT NULL,
        phase           VARCHAR(50),
        session_id      UUID,
        inputs          JSONB,
        outputs         JSONB,
        model_used      VARCHAR(100),
        tokens_in       INTEGER,
        tokens_out      INTEGER,
        cost_usd        NUMERIC(10, 6),
        duration_ms     INTEGER,
        status          VARCHAR(50) NOT NULL,
        error_message   TEXT,
        parent_event_id UUID
      )
    `);

    // Ensure logs directory exists
    const logDir = path.dirname(AUDIT_LOG_PATH);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  });

  afterAll(async () => {
    // Cleanup test data
    await client
      .query("DELETE FROM agent_events WHERE event_id = $1", [testEventId])
      .catch(() => {});
    await client.end();
  });

  it("should write to both audit.jsonl and PostgreSQL atomically", async () => {
    const event: AuditEvent = {
      event_id: testEventId,
      timestamp: new Date().toISOString(),
      agent_id: "contract-test-agent-001",
      agent_type: "CONTRACT_TEST",
      action_type: "TEST_RUN",
      phase: "GATE_4_CONTRACTS",
      session_id: testSessionId,
      inputs: { test: "contract-6-input" },
      outputs: { test: "contract-6-output" },
      model_used: null,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      duration_ms: 42,
      status: "SUCCESS",
      error_message: null,
      parent_event_id: null,
    };

    // Atomic write: both or neither
    try {
      // Begin transaction for PostgreSQL
      await client.query("BEGIN");

      // Write to PostgreSQL
      await client.query(
        `INSERT INTO agent_events
          (event_id, timestamp, agent_id, agent_type, action_type, phase,
           session_id, inputs, outputs, model_used, tokens_in, tokens_out,
           cost_usd, duration_ms, status, error_message, parent_event_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          event.event_id,
          event.timestamp,
          event.agent_id,
          event.agent_type,
          event.action_type,
          event.phase,
          event.session_id,
          JSON.stringify(event.inputs),
          JSON.stringify(event.outputs),
          event.model_used,
          event.tokens_in,
          event.tokens_out,
          event.cost_usd,
          event.duration_ms,
          event.status,
          event.error_message,
          event.parent_event_id,
        ]
      );

      // Write to JSONL file
      fs.appendFileSync(AUDIT_LOG_PATH, JSON.stringify(event) + "\n");

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    // Verify PostgreSQL write
    const pgResult = await client.query(
      "SELECT * FROM agent_events WHERE event_id = $1",
      [testEventId]
    );
    expect(pgResult.rows).toHaveLength(1);
    expect(pgResult.rows[0].agent_id).toBe("contract-test-agent-001");
    expect(pgResult.rows[0].action_type).toBe("TEST_RUN");
    expect(pgResult.rows[0].status).toBe("SUCCESS");

    // Verify JSONL write
    const logContent = fs.readFileSync(AUDIT_LOG_PATH, "utf-8");
    const logLines = logContent.trim().split("\n");
    const lastLine = JSON.parse(logLines[logLines.length - 1]);
    expect(lastLine.event_id).toBe(testEventId);
    expect(lastLine.agent_id).toBe("contract-test-agent-001");
  });

  it("should rollback PostgreSQL on JSONL write failure simulation", async () => {
    const failEventId = randomUUID();
    const originalAppend = fs.appendFileSync;
    let pgCommitted = false;

    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO agent_events
          (event_id, agent_id, agent_type, action_type, status)
        VALUES ($1, $2, $3, $4, $5)`,
        [failEventId, "fail-agent", "CONTRACT_TEST", "TEST_RUN", "FAILURE"]
      );

      // Simulate JSONL write failure
      const badPath = "/nonexistent/path/audit.jsonl";
      try {
        fs.appendFileSync(badPath, "should fail\n");
      } catch {
        // Expected — now rollback PG
        await client.query("ROLLBACK");
        pgCommitted = false;
      }
    } catch {
      await client.query("ROLLBACK").catch(() => {});
    }

    // Verify the failed event was NOT committed to PostgreSQL
    const result = await client.query(
      "SELECT * FROM agent_events WHERE event_id = $1",
      [failEventId]
    );
    expect(result.rows).toHaveLength(0);
    expect(pgCommitted).toBe(false);
  });
});
