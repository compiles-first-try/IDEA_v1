/**
 * Tests for the Secret Manager module.
 *
 * Verifies:
 * - Loads env vars from .env file via dotenv
 * - Validates all required env vars are present
 * - Throws on missing required vars
 * - Never exposes secret values in error messages or logs
 * - Provides typed access to config values
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We'll test the module by importing it after setup
describe("Secret Manager", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    // Restore original env
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("should load config from environment variables", async () => {
    process.env.POSTGRES_URL = "postgresql://user:pass@localhost:5432/db";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.TEMPORAL_ADDRESS = "localhost:7233";
    process.env.OLLAMA_BASE_URL = "http://localhost:11434";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    process.env.FOUNDRY_KILL = "0";
    process.env.MAX_DAILY_CLOUD_SPEND_USD = "10";
    process.env.AUDIT_LOG_PATH = "./logs/audit.jsonl";

    const { loadConfig } = await import("../src/secrets/index.js");
    const config = loadConfig();

    expect(config.postgresUrl).toBe("postgresql://user:pass@localhost:5432/db");
    expect(config.redisUrl).toBe("redis://localhost:6379");
    expect(config.temporalAddress).toBe("localhost:7233");
    expect(config.ollamaBaseUrl).toBe("http://localhost:11434");
    expect(config.anthropicApiKey).toBe("sk-ant-test-key");
    expect(config.foundryKill).toBe(false);
    expect(config.maxDailyCloudSpendUsd).toBe(10);
    expect(config.auditLogPath).toBe("./logs/audit.jsonl");
  });

  it("should throw on missing required env vars", async () => {
    // Remove all required vars
    delete process.env.POSTGRES_URL;
    delete process.env.REDIS_URL;
    delete process.env.TEMPORAL_ADDRESS;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.AUDIT_LOG_PATH;

    const { loadConfig } = await import("../src/secrets/index.js");
    expect(() => loadConfig()).toThrow();
  });

  it("should not expose secret values in error messages", async () => {
    process.env.POSTGRES_URL = "postgresql://user:SUPERSECRET@localhost/db";
    delete process.env.REDIS_URL;

    const { loadConfig } = await import("../src/secrets/index.js");
    try {
      loadConfig();
      expect.unreachable("Should have thrown");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).not.toContain("SUPERSECRET");
      expect(message).toContain("REDIS_URL"); // should name the missing var
    }
  });

  it("should treat ANTHROPIC_API_KEY as optional", async () => {
    process.env.POSTGRES_URL = "postgresql://u:p@localhost/db";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.TEMPORAL_ADDRESS = "localhost:7233";
    process.env.OLLAMA_BASE_URL = "http://localhost:11434";
    process.env.AUDIT_LOG_PATH = "./logs/audit.jsonl";
    delete process.env.ANTHROPIC_API_KEY;

    const { loadConfig } = await import("../src/secrets/index.js");
    const config = loadConfig();
    expect(config.anthropicApiKey).toBeUndefined();
  });

  it("should parse FOUNDRY_KILL as boolean", async () => {
    process.env.POSTGRES_URL = "postgresql://u:p@localhost/db";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.TEMPORAL_ADDRESS = "localhost:7233";
    process.env.OLLAMA_BASE_URL = "http://localhost:11434";
    process.env.AUDIT_LOG_PATH = "./logs/audit.jsonl";

    process.env.FOUNDRY_KILL = "1";
    const { loadConfig } = await import("../src/secrets/index.js");
    expect(loadConfig().foundryKill).toBe(true);

    process.env.FOUNDRY_KILL = "0";
    vi.resetModules();
    const mod2 = await import("../src/secrets/index.js");
    expect(mod2.loadConfig().foundryKill).toBe(false);
  });

  it("should provide defaults for optional values", async () => {
    process.env.POSTGRES_URL = "postgresql://u:p@localhost/db";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.TEMPORAL_ADDRESS = "localhost:7233";
    process.env.OLLAMA_BASE_URL = "http://localhost:11434";
    process.env.AUDIT_LOG_PATH = "./logs/audit.jsonl";
    delete process.env.FOUNDRY_KILL;
    delete process.env.MAX_DAILY_CLOUD_SPEND_USD;

    const { loadConfig } = await import("../src/secrets/index.js");
    const config = loadConfig();
    expect(config.foundryKill).toBe(false);
    expect(config.maxDailyCloudSpendUsd).toBe(10);
  });
});
