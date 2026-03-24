/**
 * Tests for the Governance REST API.
 *
 * Verifies all endpoints:
 * - GET /health
 * - POST /governance/stop (kill switch)
 * - GET /governance/audit?limit=N
 * - GET /governance/status
 * - POST /governance/improve
 * - GET /governance/config
 * - PATCH /governance/config
 *
 * All inputs validated with Zod. Helmet security headers.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Governance REST API", () => {
  let api: typeof import("../src/api/index.js");
  let server: http.Server;
  let port: number;
  let cache: Awaited<ReturnType<typeof import("../../foundation/src/cache/index.js")["createCacheClient"]>>;
  let db: Awaited<ReturnType<typeof import("../../foundation/src/db/index.js")["createDbClient"]>>;
  let auditLogger: Awaited<ReturnType<typeof import("../../foundation/src/audit/index.js")["createAuditLogger"]>>;

  const TEST_AUDIT = path.resolve(__dirname, "../../../logs/audit-gov-test.jsonl");

  beforeAll(async () => {
    const { createCacheClient } = await import("../../foundation/src/cache/index.js");
    const { createDbClient, runMigrations } = await import("../../foundation/src/db/index.js");
    const { createAuditLogger } = await import("../../foundation/src/audit/index.js");

    cache = await createCacheClient(process.env.REDIS_URL ?? "redis://localhost:6379");
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
    auditLogger = await createAuditLogger({ db, logPath: TEST_AUDIT });

    api = await import("../src/api/index.js");
    const app = api.createGovernanceApi({ cache, db, auditLogger });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        port = (server.address() as { port: number }).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    server?.close();
    await cache.del("rsf:kill:global", "rsf:config:maxDailySpendUsd", "rsf:config:autonomyLevel");
    await db.query("DELETE FROM agent_events WHERE agent_id IN ('kill-switch', 'governance-api')").catch(() => {});
    const fs = await import("node:fs");
    if (fs.existsSync(TEST_AUDIT)) fs.unlinkSync(TEST_AUDIT);
    await cache.disconnect();
    await db.disconnect();
  });

  const get = (path: string) => fetch(`http://localhost:${port}${path}`);
  const post = (path: string, body?: unknown) =>
    fetch(`http://localhost:${port}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  const patch = (path: string, body: unknown) =>
    fetch(`http://localhost:${port}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  describe("GET /health", () => {
    it("should return 200 with status ok", async () => {
      const res = await get("/health");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.timestamp).toBeDefined();
    });

    it("should include security headers from helmet", async () => {
      const res = await get("/health");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    });
  });

  describe("POST /governance/stop", () => {
    it("should activate the kill switch", async () => {
      const res = await post("/governance/stop");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.killed).toBe(true);

      // Verify Redis flag
      const flag = await cache.get("rsf:kill:global");
      expect(flag).toBe("1");

      // Reset for other tests
      await cache.del("rsf:kill:global");
    });
  });

  describe("GET /governance/status", () => {
    it("should return system status", async () => {
      const res = await get("/governance/status");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.killSwitchActive).toBeDefined();
      expect(typeof body.killSwitchActive).toBe("boolean");
      expect(body.dailySpend).toBeDefined();
      expect(body.timestamp).toBeDefined();
    });
  });

  describe("GET /governance/audit", () => {
    it("should return recent audit events", async () => {
      // First create an event so there's something to query
      await auditLogger.log({
        agentId: "governance-api",
        agentType: "TEST",
        actionType: "TEST_RUN",
        status: "SUCCESS",
        durationMs: 1,
      });

      const res = await get("/governance/audit?limit=5");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.events).toBeDefined();
      expect(Array.isArray(body.events)).toBe(true);
      expect(body.events.length).toBeGreaterThan(0);
      expect(body.events.length).toBeLessThanOrEqual(5);
    });

    it("should reject invalid limit parameter", async () => {
      const res = await get("/governance/audit?limit=abc");
      expect(res.status).toBe(400);
    });
  });

  describe("POST /governance/improve", () => {
    it("should return improvement cycle result", async () => {
      const res = await post("/governance/improve");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBeDefined();
      expect(body.message).toBeDefined();
    });
  });

  describe("GET /governance/config", () => {
    it("should return current configuration", async () => {
      const res = await get("/governance/config");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.maxDailySpendUsd).toBeDefined();
      expect(body.autonomyLevel).toBeDefined();
    });
  });

  describe("PATCH /governance/config", () => {
    it("should update spend limit", async () => {
      const res = await patch("/governance/config", { maxDailySpendUsd: 15 });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.maxDailySpendUsd).toBe(15);
    });

    it("should update autonomy level", async () => {
      const res = await patch("/governance/config", { autonomyLevel: "supervised" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.autonomyLevel).toBe("supervised");
    });

    it("should reject invalid config values", async () => {
      const res = await patch("/governance/config", { maxDailySpendUsd: -5 });
      expect(res.status).toBe(400);
    });
  });
});
