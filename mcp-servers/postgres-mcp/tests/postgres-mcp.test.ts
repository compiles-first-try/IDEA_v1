/**
 * Tests for the PostgreSQL MCP Server.
 *
 * Verifies:
 * - Exposes query tool with explicit column list enforcement (Rule 11)
 * - Exposes audit-query tool for reading agent_events
 * - Exposes write-audit tool for recording events
 * - Rejects SELECT * queries (CDC-readiness)
 * - Validates Zod schemas on all inputs
 * - Returns schema_version in metadata
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("PostgreSQL MCP Server", () => {
  let pgMcp: typeof import("../src/index.js");

  beforeAll(async () => {
    pgMcp = await import("../src/index.js");
  });

  it("should export tool definitions", () => {
    const tools = pgMcp.getToolDefinitions();
    expect(tools).toBeDefined();
    expect(tools.length).toBeGreaterThanOrEqual(3);

    const names = tools.map((t: { name: string }) => t.name);
    expect(names).toContain("query");
    expect(names).toContain("query-audit-events");
    expect(names).toContain("write-audit-event");
  });

  it("should execute a valid query with explicit columns", async () => {
    const result = await pgMcp.executeTool("query", {
      sql: "SELECT version, description FROM schema_migrations ORDER BY version",
    });
    expect(result.rows).toBeDefined();
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    expect(result.schema_version).toBe("2");
  });

  it("should REJECT SELECT * queries", async () => {
    await expect(
      pgMcp.executeTool("query", {
        sql: "SELECT * FROM schema_migrations",
      })
    ).rejects.toThrow(/SELECT \*/);
  });

  it("should query audit events with filtering", async () => {
    const result = await pgMcp.executeTool("query-audit-events", {
      limit: 5,
    });
    expect(result.events).toBeDefined();
    expect(Array.isArray(result.events)).toBe(true);
    expect(result.schema_version).toBe("2");
  });

  it("should write an audit event", async () => {
    const result = await pgMcp.executeTool("write-audit-event", {
      agentId: "postgres-mcp-test",
      agentType: "TEST",
      actionType: "TEST_RUN",
      status: "SUCCESS",
      durationMs: 1,
    });
    expect(result.eventId).toBeDefined();

    // Cleanup
    const { createDbClient } = await import("../../../packages/foundation/src/db/index.js");
    const db = await createDbClient(process.env.POSTGRES_URL!);
    await db.query("DELETE FROM agent_events WHERE agent_id = $1", ["postgres-mcp-test"]);
    await db.disconnect();
  });

  it("should reject invalid tool input", async () => {
    await expect(
      pgMcp.executeTool("query", { sql: 123 })
    ).rejects.toThrow();
  });
});
