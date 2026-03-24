/**
 * Contract 2: TypeScript → Redis
 *
 * Verifies:
 * - Can SET and GET a key
 * - TTL expiry works correctly
 * - Can LPUSH and LPOP (for queue patterns)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Redis from "ioredis";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Contract 2: TypeScript → Redis", () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      lazyConnect: true,
    });
    return redis.connect();
  });

  afterAll(async () => {
    // Cleanup test keys
    await redis.del(
      "contract2:test-key",
      "contract2:ttl-key",
      "contract2:queue"
    );
    redis.disconnect();
  });

  it("should SET and GET a key", async () => {
    const result = await redis.set("contract2:test-key", "hello-rsf");
    expect(result).toBe("OK");

    const value = await redis.get("contract2:test-key");
    expect(value).toBe("hello-rsf");
  });

  it("should expire keys using TTL", async () => {
    // Set key with 1 second TTL
    await redis.set("contract2:ttl-key", "expires-soon", "EX", 1);

    // Key should exist immediately
    const before = await redis.get("contract2:ttl-key");
    expect(before).toBe("expires-soon");

    // Wait for expiry
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Key should be gone
    const after = await redis.get("contract2:ttl-key");
    expect(after).toBeNull();
  });

  it("should LPUSH and LPOP (queue pattern)", async () => {
    // Push three items
    await redis.lpush("contract2:queue", "item-1");
    await redis.lpush("contract2:queue", "item-2");
    await redis.lpush("contract2:queue", "item-3");

    // List length should be 3
    const len = await redis.llen("contract2:queue");
    expect(len).toBe(3);

    // RPOP retrieves in FIFO order (oldest first)
    const first = await redis.rpop("contract2:queue");
    expect(first).toBe("item-1");

    const second = await redis.rpop("contract2:queue");
    expect(second).toBe("item-2");

    const third = await redis.rpop("contract2:queue");
    expect(third).toBe("item-3");

    // Queue should be empty
    const empty = await redis.rpop("contract2:queue");
    expect(empty).toBeNull();
  });
});
