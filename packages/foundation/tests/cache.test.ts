/**
 * Tests for the Redis cache client.
 *
 * Verifies:
 * - Connects from config URL
 * - get/set with optional TTL
 * - getJson/setJson for structured data
 * - delete keys
 * - Check kill switch flag
 * - Track daily spend in Redis
 * - Properly disconnects
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Redis Cache Client", () => {
  let cache: Awaited<ReturnType<typeof import("../src/cache/index.js")["createCacheClient"]>>;

  beforeAll(async () => {
    const { createCacheClient } = await import("../src/cache/index.js");
    cache = await createCacheClient(process.env.REDIS_URL ?? "redis://localhost:6379");
  });

  afterAll(async () => {
    // Cleanup test keys
    await cache.del("test:string", "test:json", "test:ttl", "test:kill", "test:spend");
    await cache.disconnect();
  });

  it("should set and get a string value", async () => {
    await cache.set("test:string", "hello");
    const val = await cache.get("test:string");
    expect(val).toBe("hello");
  });

  it("should set with TTL and expire", async () => {
    await cache.set("test:ttl", "expires", 1);
    const before = await cache.get("test:ttl");
    expect(before).toBe("expires");

    await new Promise((r) => setTimeout(r, 1500));
    const after = await cache.get("test:ttl");
    expect(after).toBeNull();
  });

  it("should set and get JSON objects", async () => {
    const obj = { agentId: "test-001", score: 0.95, tags: ["a", "b"] };
    await cache.setJson("test:json", obj);
    const result = await cache.getJson<typeof obj>("test:json");
    expect(result).toEqual(obj);
  });

  it("should return null for missing keys", async () => {
    const val = await cache.get("nonexistent:key:12345");
    expect(val).toBeNull();
    const json = await cache.getJson("nonexistent:json:12345");
    expect(json).toBeNull();
  });

  it("should delete keys", async () => {
    await cache.set("test:string", "to-delete");
    await cache.del("test:string");
    const val = await cache.get("test:string");
    expect(val).toBeNull();
  });

  it("should support kill switch flag pattern", async () => {
    // Kill switch: set a flag with no TTL
    await cache.set("test:kill", "1");
    const active = await cache.get("test:kill");
    expect(active).toBe("1");

    // Clear it
    await cache.del("test:kill");
    const cleared = await cache.get("test:kill");
    expect(cleared).toBeNull();
  });

  it("should support incrementing spend tracking", async () => {
    await cache.del("test:spend");
    const v1 = await cache.incrByFloat("test:spend", 0.015);
    expect(v1).toBeCloseTo(0.015, 4);
    const v2 = await cache.incrByFloat("test:spend", 0.001);
    expect(v2).toBeCloseTo(0.016, 4);
  });
});
