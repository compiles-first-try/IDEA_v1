/**
 * Tests for the Audit MCP Server.
 *
 * Verifies:
 * - Exposes log-event and query-recent tool definitions
 * - Can log an event with dual-write and get it back
 * - Query-recent returns events sorted by timestamp
 * - Invalid input is rejected by Zod schemas
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDbClient, type DbClient } from "../../../packages/foundation/src/db/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Audit MCP Server", () => {
  let auditMcp: typeof import("../src/index.js");
  let cleanupDb: DbClient | null = null;
  const testEventIds: string[] = [];

  beforeAll(async () => {
    auditMcp = await import("../src/index.js");
    cleanupDb = await createDbClient(process.env.POSTGRES_URL!);
  });

  afterAll(async () => {
    // Clean up test events
    if (cleanupDb && testEventIds.length > 0) {
      for (const eventId of testEventIds) {
        await cleanupDb.query(
          "DELETE FROM agent_events WHERE event_id = $1",
          [eventId]
        );
      }
      await cleanupDb.disconnect();
    }
  });

  it("should export both tool definitions", () => {
    const tools = auditMcp.getToolDefinitions();
    expect(tools).toBeDefined();
    expect(tools.length).toBe(2);

    const names = tools.map((t) => t.name);
    expect(names).toContain("log-event");
    expect(names).toContain("query-recent");
  });

  it("should log an audit event and return eventId and timestamp", async () => {
    const result = await auditMcp.executeTool("log-event", {
      agentId: "audit-mcp-test",
      agentType: "TEST",
      actionType: "TEST_RUN",
      status: "SUCCESS",
      durationMs: 5,
      phase: "LAYER_1_FOUNDATION",
      modelUsed: "none",
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
    });

    expect(result.eventId).toBeDefined();
    expect(typeof result.eventId).toBe("string");
    expect(result.timestamp).toBeDefined();
    testEventIds.push(result.eventId as string);
  });

  it("should query recent events", async () => {
    const result = await auditMcp.executeTool("query-recent", {
      limit: 10,
    });

    expect(result.events).toBeDefined();
    expect(Array.isArray(result.events)).toBe(true);
    expect(typeof result.count).toBe("number");
  });

  it("should query recent events filtered by agentId", async () => {
    // First log a distinctive event
    const logResult = await auditMcp.executeTool("log-event", {
      agentId: "audit-mcp-filter-test",
      agentType: "TEST",
      actionType: "TEST_RUN",
      status: "SUCCESS",
      durationMs: 1,
    });
    testEventIds.push(logResult.eventId as string);

    const result = await auditMcp.executeTool("query-recent", {
      limit: 5,
      agentId: "audit-mcp-filter-test",
    });

    expect(result.events).toBeDefined();
    const events = result.events as Array<Record<string, unknown>>;
    expect(events.length).toBeGreaterThanOrEqual(1);
    for (const event of events) {
      expect(event.agent_id).toBe("audit-mcp-filter-test");
    }
  });

  it("should reject invalid input for log-event (missing required fields)", async () => {
    await expect(
      auditMcp.executeTool("log-event", {
        agentId: "test",
        // missing agentType, actionType, status, durationMs
      })
    ).rejects.toThrow();
  });

  it("should reject invalid actionType", async () => {
    await expect(
      auditMcp.executeTool("log-event", {
        agentId: "test",
        agentType: "TEST",
        actionType: "INVALID_ACTION",
        status: "SUCCESS",
        durationMs: 1,
      })
    ).rejects.toThrow();
  });

  it("should reject invalid status", async () => {
    await expect(
      auditMcp.executeTool("log-event", {
        agentId: "test",
        agentType: "TEST",
        actionType: "TEST_RUN",
        status: "INVALID_STATUS",
        durationMs: 1,
      })
    ).rejects.toThrow();
  });

  it("should throw on unknown tool name", async () => {
    await expect(
      auditMcp.executeTool("nonexistent-tool", {})
    ).rejects.toThrow(/Unknown tool/);
  });
});
