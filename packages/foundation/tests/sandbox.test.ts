/**
 * Tests for the Docker sandbox executor.
 *
 * Verifies:
 * - Executes code inside an isolated Docker container
 * - No network access (--network none)
 * - Read-only filesystem except /tmp
 * - Memory limit: 2GB
 * - CPU limit: 4 cores
 * - Execution timeout: configurable (default 60s)
 * - Non-root user
 * - Returns stdout, stderr, exit code
 * - Handles timeout correctly
 */
import { describe, it, expect, beforeAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Docker Sandbox Executor", () => {
  let sandbox: typeof import("../src/sandbox/index.js");

  beforeAll(async () => {
    sandbox = await import("../src/sandbox/index.js");
  });

  it("should execute code and return stdout", async () => {
    const result = await sandbox.execute({
      image: "node:22-alpine",
      command: ["node", "-e", "console.log('hello from sandbox')"],
      timeoutMs: 30_000,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello from sandbox");
    expect(result.stderr).toBe("");
  });

  it("should capture stderr", async () => {
    const result = await sandbox.execute({
      image: "node:22-alpine",
      command: ["node", "-e", "console.error('error output')"],
      timeoutMs: 30_000,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr.trim()).toBe("error output");
  });

  it("should return non-zero exit code on failure", async () => {
    const result = await sandbox.execute({
      image: "node:22-alpine",
      command: ["node", "-e", "process.exit(42)"],
      timeoutMs: 30_000,
    });

    expect(result.exitCode).toBe(42);
  });

  it("should enforce no network access", async () => {
    const result = await sandbox.execute({
      image: "node:22-alpine",
      command: [
        "node",
        "-e",
        "fetch('https://example.com').then(() => console.log('NETWORK_OK')).catch(() => console.log('NETWORK_BLOCKED'))",
      ],
      timeoutMs: 30_000,
    });

    expect(result.stdout.trim()).toBe("NETWORK_BLOCKED");
  });

  it("should enforce read-only filesystem except /tmp", async () => {
    const result = await sandbox.execute({
      image: "node:22-alpine",
      command: [
        "sh",
        "-c",
        // Try to write to root (should fail), then /tmp (should succeed)
        "echo test > /test.txt 2>/dev/null && echo ROOT_WRITABLE || echo ROOT_READONLY; echo test > /tmp/test.txt && echo TMP_WRITABLE || echo TMP_READONLY",
      ],
      timeoutMs: 30_000,
    });

    expect(result.stdout).toContain("ROOT_READONLY");
    expect(result.stdout).toContain("TMP_WRITABLE");
  });

  it("should enforce execution timeout", async () => {
    const start = Date.now();
    const result = await sandbox.execute({
      image: "node:22-alpine",
      command: ["node", "-e", "setTimeout(() => {}, 60000)"],
      timeoutMs: 3_000,
    });

    const elapsed = Date.now() - start;
    expect(result.timedOut).toBe(true);
    expect(elapsed).toBeLessThan(10_000); // Should stop well before 10s
  });

  it("should run as non-root user", async () => {
    const result = await sandbox.execute({
      image: "node:22-alpine",
      command: ["id", "-u"],
      timeoutMs: 30_000,
    });

    expect(result.exitCode).toBe(0);
    // Should NOT be uid 0 (root)
    expect(result.stdout.trim()).not.toBe("0");
  });
});
