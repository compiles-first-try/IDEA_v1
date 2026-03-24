import { Redis } from "ioredis";

export interface CacheClient {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttlSeconds?: number) => Promise<void>;
  getJson: <T = unknown>(key: string) => Promise<T | null>;
  setJson: <T = unknown>(key: string, value: T, ttlSeconds?: number) => Promise<void>;
  del: (...keys: string[]) => Promise<void>;
  incrByFloat: (key: string, amount: number) => Promise<number>;
  disconnect: () => Promise<void>;
  redis: Redis;
}

/**
 * Create a Redis cache client from a connection URL.
 * Provides typed helpers for common operations.
 */
export async function createCacheClient(redisUrl: string): Promise<CacheClient> {
  const redis = new Redis(redisUrl, { lazyConnect: true });
  await redis.connect();

  return {
    async get(key: string): Promise<string | null> {
      return redis.get(key);
    },

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
      if (ttlSeconds !== undefined) {
        await redis.set(key, value, "EX", ttlSeconds);
      } else {
        await redis.set(key, value);
      }
    },

    async getJson<T = unknown>(key: string): Promise<T | null> {
      const raw = await redis.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    },

    async setJson<T = unknown>(
      key: string,
      value: T,
      ttlSeconds?: number
    ): Promise<void> {
      const serialized = JSON.stringify(value);
      if (ttlSeconds !== undefined) {
        await redis.set(key, serialized, "EX", ttlSeconds);
      } else {
        await redis.set(key, serialized);
      }
    },

    async del(...keys: string[]): Promise<void> {
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    },

    async incrByFloat(key: string, amount: number): Promise<number> {
      const result = await redis.incrbyfloat(key, amount);
      return parseFloat(result);
    },

    async disconnect(): Promise<void> {
      redis.disconnect();
    },

    redis,
  };
}
