/**
 * Tests for the Configuration Manager.
 *
 * Verifies:
 * - Loads default configuration
 * - Validates config changes with Zod
 * - Persists changes to Redis
 * - Rejects invalid values (negative spend, unknown autonomy level)
 * - Returns full config after update
 * - Audits config changes
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Configuration Manager", () => {
  let configMgr: typeof import("../src/config/index.js");
  let cache: Awaited<ReturnType<typeof import("../../foundation/src/cache/index.js")["createCacheClient"]>>;
  let db: Awaited<ReturnType<typeof import("../../foundation/src/db/index.js")["createDbClient"]>>;
  let auditLogger: Awaited<ReturnType<typeof import("../../foundation/src/audit/index.js")["createAuditLogger"]>>;

  const TEST_AUDIT = path.resolve(__dirname, "../../../logs/audit-config-test.jsonl");

  beforeAll(async () => {
    const { createCacheClient } = await import("../../foundation/src/cache/index.js");
    const { createDbClient, runMigrations } = await import("../../foundation/src/db/index.js");
    const { createAuditLogger } = await import("../../foundation/src/audit/index.js");

    cache = await createCacheClient(process.env.REDIS_URL ?? "redis://localhost:6379");
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
    auditLogger = await createAuditLogger({ db, logPath: TEST_AUDIT });
    configMgr = await import("../src/config/index.js");
  });

  afterAll(async () => {
    await cache.del("rsf:config:maxDailySpendUsd", "rsf:config:pauseThresholdUsd", "rsf:config:autonomyLevel", "rsf:config:improvementAutoTrigger");
    await db.query("DELETE FROM agent_events WHERE agent_id = 'config-manager'").catch(() => {});
    const fs = await import("node:fs");
    if (fs.existsSync(TEST_AUDIT)) fs.unlinkSync(TEST_AUDIT);
    await cache.disconnect();
    await db.disconnect();
  });

  it("should return default configuration", async () => {
    const mgr = configMgr.createConfigManager({ cache, auditLogger });
    const config = await mgr.getAll();

    expect(config.maxDailySpendUsd).toBe(10);
    expect(config.pauseThresholdUsd).toBe(20);
    expect(config.autonomyLevel).toBe("supervised");
    expect(config.improvementAutoTrigger).toBe(false);
  });

  it("should update a valid config value", async () => {
    const mgr = configMgr.createConfigManager({ cache, auditLogger });
    const result = await mgr.update({ maxDailySpendUsd: 25 });

    expect(result.maxDailySpendUsd).toBe(25);
  });

  it("should persist config to Redis", async () => {
    const mgr = configMgr.createConfigManager({ cache, auditLogger });
    await mgr.update({ autonomyLevel: "manual" });

    const raw = await cache.get("rsf:config:autonomyLevel");
    expect(raw).toBe("manual");
  });

  it("should reject negative spend limit", async () => {
    const mgr = configMgr.createConfigManager({ cache, auditLogger });
    await expect(mgr.update({ maxDailySpendUsd: -5 })).rejects.toThrow();
  });

  it("should reject invalid autonomy level", async () => {
    const mgr = configMgr.createConfigManager({ cache, auditLogger });
    await expect(
      mgr.update({ autonomyLevel: "rogue" as "autonomous" })
    ).rejects.toThrow();
  });

  it("should return full config after partial update", async () => {
    const mgr = configMgr.createConfigManager({ cache, auditLogger });
    // Reset
    await mgr.update({ maxDailySpendUsd: 10, autonomyLevel: "supervised" });

    // Partial update
    const result = await mgr.update({ pauseThresholdUsd: 30 });
    expect(result.maxDailySpendUsd).toBe(10);
    expect(result.pauseThresholdUsd).toBe(30);
    expect(result.autonomyLevel).toBe("supervised");
  });

  it("should audit config changes", async () => {
    const mgr = configMgr.createConfigManager({ cache, auditLogger });
    await mgr.update({ maxDailySpendUsd: 15 });

    const events = await db.query(
      `SELECT * FROM agent_events WHERE agent_id = 'config-manager' AND action_type = 'CONFIG_UPDATE' ORDER BY timestamp DESC LIMIT 1`
    );
    expect(events.rows.length).toBeGreaterThanOrEqual(1);
  });
});
