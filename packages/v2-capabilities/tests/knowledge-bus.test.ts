/**
 * Knowledge Propagation Bus + Stigmergic Blackboard
 *
 * Event bus via Postgres LISTEN/NOTIFY + Redis blackboard with decaying signals.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Knowledge Propagation Bus", () => {
  let bus: typeof import("../src/knowledge-bus/index.js");
  let cache: Awaited<ReturnType<typeof import("../../foundation/src/cache/index.js")["createCacheClient"]>>;
  let db: Awaited<ReturnType<typeof import("../../foundation/src/db/index.js")["createDbClient"]>>;

  beforeAll(async () => {
    const { createCacheClient } = await import("../../foundation/src/cache/index.js");
    const { createDbClient, runMigrations } = await import("../../foundation/src/db/index.js");
    cache = await createCacheClient(process.env.REDIS_URL ?? "redis://localhost:6379");
    db = await createDbClient(process.env.POSTGRES_URL!);
    await runMigrations(db, path.resolve(__dirname, "../../../db/migrations"));
    bus = await import("../src/knowledge-bus/index.js");
  });

  afterAll(async () => {
    await cache.del("rsf:signal:test-topic:*");
    await cache.disconnect();
    await db.disconnect();
  });

  describe("Event Bus", () => {
    it("should emit a DISCOVERY event", async () => {
      const event = await bus.emitEvent(db, {
        eventType: "DISCOVERY",
        sourceAgent: "test-agent",
        content: "Found that adding examples improves code gen by 15%",
        confidence: 0.85,
        affectedWorkflows: ["build-pipeline/task-2-generate-code"],
      });
      expect(event.id).toBeDefined();
      expect(event.validationStatus).toBe("PENDING");

      // Cleanup
      await db.query("DELETE FROM knowledge_events WHERE id = $1", [event.id]);
    });

    it("should query recent events", async () => {
      // Insert a test event
      await bus.emitEvent(db, {
        eventType: "WARNING",
        sourceAgent: "test-agent",
        content: "Model qwen2.5 producing malformed JSON at rate 5%",
        confidence: 0.9,
        affectedWorkflows: ["build-pipeline"],
      });

      const events = await bus.queryEvents(db, { limit: 5 });
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].event_type).toBeDefined();

      // Cleanup
      await db.query("DELETE FROM knowledge_events WHERE source_agent = $1", ["test-agent"]);
    });

    it("should validate a discovery before propagation", async () => {
      const result = bus.validateDiscovery({
        content: "Adding 3 examples to code gen prompt improves output",
        confidence: 0.85,
        isReproducible: true,
        conflictsWithExisting: false,
        basedOnSyntheticData: false,
      });
      expect(result.validated).toBe(true);
      expect(result.reason).toContain("reproducible");
    });

    it("should reject unvalidated discoveries", () => {
      const result = bus.validateDiscovery({
        content: "Something maybe useful",
        confidence: 0.3,
        isReproducible: false,
        conflictsWithExisting: true,
        basedOnSyntheticData: false,
      });
      expect(result.validated).toBe(false);
    });
  });

  describe("Stigmergic Blackboard", () => {
    it("should post a signal with TTL based on confidence", async () => {
      await bus.postSignal(cache, {
        topic: "test-topic",
        content: "Useful pattern discovered",
        confidence: 0.9,
        sourceAgent: "test-agent",
      });

      const signal = await bus.readSignal(cache, "test-topic");
      expect(signal).toBeDefined();
      expect(signal!.content).toBe("Useful pattern discovered");
    });

    it("should return null for expired/missing signals", async () => {
      const signal = await bus.readSignal(cache, "nonexistent-topic-xyz");
      expect(signal).toBeNull();
    });

    it("should set longer TTL for higher confidence signals", async () => {
      const highConf = bus.calculateTTL(0.95);
      const lowConf = bus.calculateTTL(0.3);
      expect(highConf).toBeGreaterThan(lowConf);
    });
  });
});
