/**
 * Tests for the Audit Log Viewer.
 *
 * Verifies:
 * - Queries agent_events with filtering (agentId, actionType, status, date range)
 * - Paginates results
 * - Formats as readable CLI report
 * - Includes summary statistics
 * - Handles empty results
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Audit Log Viewer", () => {
  let viewer: typeof import("../src/audit-dashboard/index.js");
  let db: Awaited<ReturnType<typeof import("../../foundation/src/db/index.js")["createDbClient"]>>;
  let auditLogger: Awaited<ReturnType<typeof import("../../foundation/src/audit/index.js")["createAuditLogger"]>>;

  const TEST_AUDIT = path.resolve(__dirname, "../../../logs/audit-viewer-test.jsonl");

  beforeAll(async () => {
    const { createDbClient, runMigrations } = await import("../../foundation/src/db/index.js");
    const { createAuditLogger } = await import("../../foundation/src/audit/index.js");
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
    auditLogger = await createAuditLogger({ db, logPath: TEST_AUDIT });
    viewer = await import("../src/audit-dashboard/index.js");

    // Seed test events
    for (const [agentId, actionType, status] of [
      ["viewer-test-agent-1", "LLM_CALL", "SUCCESS"],
      ["viewer-test-agent-1", "TOOL_CALL", "SUCCESS"],
      ["viewer-test-agent-2", "CODE_EXECUTE", "FAILURE"],
      ["viewer-test-agent-1", "LLM_CALL", "SUCCESS"],
      ["viewer-test-agent-3", "DECISION", "SUCCESS"],
    ] as const) {
      await auditLogger.log({
        agentId,
        agentType: "TEST",
        actionType,
        status,
        durationMs: Math.floor(Math.random() * 5000),
      });
    }
  });

  afterAll(async () => {
    await db.query("DELETE FROM agent_events WHERE agent_id LIKE 'viewer-test-%'").catch(() => {});
    const fs = await import("node:fs");
    if (fs.existsSync(TEST_AUDIT)) fs.unlinkSync(TEST_AUDIT);
    await db.disconnect();
  });

  it("should query recent events", async () => {
    const v = viewer.createAuditViewer({ db });
    const result = await v.query({ limit: 10 });
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events[0].agent_id).toBeDefined();
    expect(result.events[0].action_type).toBeDefined();
  });

  it("should filter by agentId", async () => {
    const v = viewer.createAuditViewer({ db });
    const result = await v.query({ agentId: "viewer-test-agent-2", limit: 10 });
    expect(result.events.length).toBeGreaterThanOrEqual(1);
    expect(result.events.every(e => e.agent_id === "viewer-test-agent-2")).toBe(true);
  });

  it("should filter by actionType", async () => {
    const v = viewer.createAuditViewer({ db });
    const result = await v.query({ actionType: "LLM_CALL", limit: 10 });
    expect(result.events.length).toBeGreaterThanOrEqual(1);
    expect(result.events.every(e => e.action_type === "LLM_CALL")).toBe(true);
  });

  it("should filter by status", async () => {
    const v = viewer.createAuditViewer({ db });
    const result = await v.query({ status: "FAILURE", limit: 10 });
    expect(result.events.length).toBeGreaterThanOrEqual(1);
    expect(result.events.every(e => e.status === "FAILURE")).toBe(true);
  });

  it("should paginate results", async () => {
    const v = viewer.createAuditViewer({ db });
    const page1 = await v.query({ limit: 2, offset: 0 });
    const page2 = await v.query({ limit: 2, offset: 2 });

    expect(page1.events.length).toBeLessThanOrEqual(2);
    if (page2.events.length > 0) {
      expect(page1.events[0].event_id).not.toBe(page2.events[0].event_id);
    }
  });

  it("should format as a CLI report string", async () => {
    const v = viewer.createAuditViewer({ db });
    const report = await v.formatReport({ limit: 5 });

    expect(typeof report).toBe("string");
    expect(report).toContain("Agent");
    expect(report).toContain("Action");
    expect(report).toContain("Status");
    expect(report.length).toBeGreaterThan(50);
  });

  it("should include summary statistics", async () => {
    const v = viewer.createAuditViewer({ db });
    const stats = await v.getStats();

    expect(stats.totalEvents).toBeGreaterThan(0);
    expect(stats.uniqueAgents).toBeGreaterThan(0);
    expect(stats.successRate).toBeDefined();
    expect(stats.successRate).toBeGreaterThanOrEqual(0);
    expect(stats.successRate).toBeLessThanOrEqual(1);
  });

  it("should handle empty results gracefully", async () => {
    const v = viewer.createAuditViewer({ db });
    const result = await v.query({ agentId: "nonexistent-agent-xyz", limit: 10 });
    expect(result.events).toHaveLength(0);

    const report = await v.formatReport({ agentId: "nonexistent-agent-xyz", limit: 10 });
    expect(report).toContain("No events");
  });
});
