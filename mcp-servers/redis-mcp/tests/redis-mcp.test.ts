/**
 * Tests for the Redis MCP Server.
 *
 * Verifies:
 * - Exposes all 8 tool definitions with correct names
 * - Basic set/get operations work end-to-end
 * - Kill switch check returns boolean
 * - Daily spend tracking works with atomic increment
 * - Invalid input is rejected by Zod schemas
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCacheClient, type CacheClient } from "../../../packages/foundation/src/cache/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Redis MCP Server", () => {
  let redisMcp: typeof import("../src/index.js");
  let cleanupClient: CacheClient | null = null;
  const testKeys: string[] = [];

  beforeAll(async () => {
    redisMcp = await import("../src/index.js");
    cleanupClient = await createCacheClient(process.env.REDIS_URL!);
  });

  afterAll(async () => {
    // Clean up test keys
    if (cleanupClient && testKeys.length > 0) {
      await cleanupClient.del(...testKeys);
      await cleanupClient.disconnect();
    }
  });

  it("should export all 8 tool definitions", () => {
    const tools = redisMcp.getToolDefinitions();
    expect(tools).toBeDefined();
    expect(tools.length).toBe(8);

    const names = tools.map((t) => t.name);
    expect(names).toContain("get");
    expect(names).toContain("set");
    expect(names).toContain("get-json");
    expect(names).toContain("set-json");
    expect(names).toContain("delete");
    expect(names).toContain("check-kill-switch");
    expect(names).toContain("get-daily-spend");
    expect(names).toContain("increment-spend");
  });

  it("should set and get a string value", async () => {
    const testKey = "rsf:test:redis-mcp:string:" + Date.now();
    testKeys.push(testKey);

    await redisMcp.executeTool("set", { key: testKey, value: "hello-world" });
    const result = await redisMcp.executeTool("get", { key: testKey });

    expect(result.value).toBe("hello-world");
    expect(result.exists).toBe(true);
  });

  it("should return null for non-existent key", async () => {
    const result = await redisMcp.executeTool("get", {
      key: "rsf:test:nonexistent:" + Date.now(),
    });
    expect(result.value).toBeNull();
    expect(result.exists).toBe(false);
  });

  it("should set and get JSON values", async () => {
    const testKey = "rsf:test:redis-mcp:json:" + Date.now();
    testKeys.push(testKey);

    const testObj = { name: "test", count: 42, nested: { flag: true } };
    await redisMcp.executeTool("set-json", { key: testKey, value: testObj });
    const result = await redisMcp.executeTool("get-json", { key: testKey });

    expect(result.value).toEqual(testObj);
    expect(result.exists).toBe(true);
  });

  it("should delete a key", async () => {
    const testKey = "rsf:test:redis-mcp:delete:" + Date.now();
    await redisMcp.executeTool("set", { key: testKey, value: "to-delete" });
    await redisMcp.executeTool("delete", { key: testKey });

    const result = await redisMcp.executeTool("get", { key: testKey });
    expect(result.exists).toBe(false);
  });

  it("should check kill switch and return boolean", async () => {
    const result = await redisMcp.executeTool("check-kill-switch", {});
    expect(typeof result.active).toBe("boolean");
    expect(result).toHaveProperty("rawValue");
  });

  it("should track daily spend", async () => {
    const result = await redisMcp.executeTool("get-daily-spend", {});
    expect(typeof result.spendUsd).toBe("number");
    expect(result.spendUsd).toBeGreaterThanOrEqual(0);
  });

  it("should increment daily spend atomically", async () => {
    const before = await redisMcp.executeTool("get-daily-spend", {});
    const beforeSpend = before.spendUsd as number;

    const result = await redisMcp.executeTool("increment-spend", { amount: 0.001 });
    expect(result.spendUsd).toBeCloseTo(beforeSpend + 0.001, 4);
    expect(result.incrementedBy).toBe(0.001);
  });

  it("should reject invalid input for set (missing key)", async () => {
    await expect(
      redisMcp.executeTool("set", { value: "no-key" })
    ).rejects.toThrow();
  });

  it("should reject invalid input for increment-spend (negative amount)", async () => {
    await expect(
      redisMcp.executeTool("increment-spend", { amount: -1 })
    ).rejects.toThrow();
  });

  it("should throw on unknown tool name", async () => {
    await expect(
      redisMcp.executeTool("nonexistent-tool", {})
    ).rejects.toThrow(/Unknown tool/);
  });
});
