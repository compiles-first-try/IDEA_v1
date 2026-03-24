/**
 * Tests for the Kill Switch — 3 independent mechanisms.
 *
 * 1. HTTP endpoint: POST /governance/stop → sets Redis flag
 * 2. Environment variable: FOUNDRY_KILL=1
 * 3. SIGTERM/SIGINT graceful shutdown
 *
 * All kills must be audited.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import express from "express";
import http from "node:http";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Kill Switch", () => {
  let killSwitch: typeof import("../src/kill-switch/index.js");
  let cache: Awaited<ReturnType<typeof import("../../foundation/src/cache/index.js")["createCacheClient"]>>;
  let db: Awaited<ReturnType<typeof import("../../foundation/src/db/index.js")["createDbClient"]>>;
  let auditLogger: Awaited<ReturnType<typeof import("../../foundation/src/audit/index.js")["createAuditLogger"]>>;
  let ks: Awaited<ReturnType<typeof killSwitch.createKillSwitch>>;

  const TEST_AUDIT_PATH = path.resolve(__dirname, "../../../logs/audit-ks-test.jsonl");

  beforeAll(async () => {
    const { createCacheClient } = await import("../../foundation/src/cache/index.js");
    const { createDbClient, runMigrations } = await import("../../foundation/src/db/index.js");
    const { createAuditLogger } = await import("../../foundation/src/audit/index.js");

    cache = await createCacheClient(process.env.REDIS_URL ?? "redis://localhost:6379");
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
    auditLogger = await createAuditLogger({ db, logPath: TEST_AUDIT_PATH });

    killSwitch = await import("../src/kill-switch/index.js");
    ks = await killSwitch.createKillSwitch({ cache, auditLogger });
  });

  afterEach(async () => {
    // Reset kill state between tests
    await ks.reset();
    delete process.env.FOUNDRY_KILL;
  });

  afterAll(async () => {
    await cache.del("rsf:kill:global");
    await db.query("DELETE FROM agent_events WHERE agent_id = 'kill-switch'").catch(() => {});
    const fs = await import("node:fs");
    if (fs.existsSync(TEST_AUDIT_PATH)) fs.unlinkSync(TEST_AUDIT_PATH);
    await cache.disconnect();
    await db.disconnect();
  });

  describe("Mechanism 1: Redis flag", () => {
    it("should not be active initially", async () => {
      const active = await ks.isActive();
      expect(active).toBe(false);
    });

    it("should activate via Redis flag", async () => {
      await ks.activate("test-user", "REDIS");
      const active = await ks.isActive();
      expect(active).toBe(true);
    });

    it("should deactivate (reset) the Redis flag", async () => {
      await ks.activate("test-user", "REDIS");
      await ks.reset();
      const active = await ks.isActive();
      expect(active).toBe(false);
    });
  });

  describe("Mechanism 2: Environment variable", () => {
    it("should detect FOUNDRY_KILL=1", async () => {
      process.env.FOUNDRY_KILL = "1";
      const active = await ks.isActive();
      expect(active).toBe(true);
    });

    it("should not trigger when FOUNDRY_KILL=0", async () => {
      process.env.FOUNDRY_KILL = "0";
      const active = await ks.isActive();
      expect(active).toBe(false);
    });
  });

  describe("HTTP endpoint", () => {
    let server: http.Server;
    let port: number;

    beforeAll(async () => {
      const app = express();
      ks.mountRoutes(app);
      await new Promise<void>((resolve) => {
        server = app.listen(0, () => {
          port = (server.address() as { port: number }).port;
          resolve();
        });
      });
    });

    afterAll(() => {
      server?.close();
    });

    it("POST /governance/stop should activate kill switch", async () => {
      const res = await fetch(`http://localhost:${port}/governance/stop`, {
        method: "POST",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.killed).toBe(true);

      const active = await ks.isActive();
      expect(active).toBe(true);
    });

    it("GET /governance/status should return current state", async () => {
      await ks.reset();
      const res = await fetch(`http://localhost:${port}/governance/status`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.active).toBe(false);
    });
  });

  describe("Audit logging", () => {
    it("should log kill events to audit", async () => {
      await ks.activate("audit-test-user", "HTTP");

      // Verify event was logged to PostgreSQL
      const result = await db.query(
        `SELECT * FROM agent_events
         WHERE agent_id = 'kill-switch'
         AND action_type = 'KILL_SWITCH_ACTIVATED'
         ORDER BY timestamp DESC LIMIT 1`
      );
      expect(result.rows.length).toBeGreaterThanOrEqual(1);
      expect(result.rows[0].status).toBe("SUCCESS");
    });
  });

  describe("Agent loop guard", () => {
    it("should provide a check function for agent loops", async () => {
      let iterations = 0;
      await ks.reset();

      // Simulate an agent loop
      for (let i = 0; i < 5; i++) {
        if (await ks.isActive()) break;
        iterations++;
        if (i === 2) {
          await ks.activate("loop-test", "REDIS");
        }
      }

      // Should have run 3 iterations (0, 1, 2) then killed on check at i=3
      expect(iterations).toBe(3);
    });
  });
});
