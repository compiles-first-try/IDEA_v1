/**
 * Tests for the Sandbox MCP Server.
 *
 * Verifies:
 * - Exposes the execute-code tool definition
 * - Can execute simple code in a Docker container
 * - Enforces resource limits and security constraints
 * - Rejects invalid input via Zod schemas
 */
import { describe, it, expect, beforeAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Sandbox MCP Server", () => {
  let sandboxMcp: typeof import("../src/index.js");

  beforeAll(async () => {
    sandboxMcp = await import("../src/index.js");
  });

  it("should export the execute-code tool definition", () => {
    const tools = sandboxMcp.getToolDefinitions();
    expect(tools).toBeDefined();
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe("execute-code");
    expect(tools[0].description).toContain("Docker");
    expect(tools[0].description).toContain("isolated");
  });

  it("should execute simple echo command in container", async () => {
    const result = await sandboxMcp.executeTool("execute-code", {
      image: "alpine:latest",
      command: ["echo", "hello from sandbox"],
      timeoutMs: 30000,
    });

    expect(result.stdout).toContain("hello from sandbox");
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(typeof result.durationMs).toBe("number");
  }, 60000);

  it("should capture stderr output", async () => {
    const result = await sandboxMcp.executeTool("execute-code", {
      image: "alpine:latest",
      command: ["sh", "-c", "echo error-output >&2"],
      timeoutMs: 30000,
    });

    expect(result.stderr).toContain("error-output");
  }, 60000);

  it("should return non-zero exit code for failing commands", async () => {
    const result = await sandboxMcp.executeTool("execute-code", {
      image: "alpine:latest",
      command: ["sh", "-c", "exit 42"],
      timeoutMs: 30000,
    });

    expect(result.exitCode).toBe(42);
  }, 60000);

  it("should reject invalid input (missing image)", async () => {
    await expect(
      sandboxMcp.executeTool("execute-code", {
        command: ["echo", "no-image"],
      })
    ).rejects.toThrow();
  });

  it("should reject invalid input (empty command array)", async () => {
    await expect(
      sandboxMcp.executeTool("execute-code", {
        image: "alpine:latest",
        command: [],
      })
    ).rejects.toThrow();
  });

  it("should reject timeout exceeding max", async () => {
    await expect(
      sandboxMcp.executeTool("execute-code", {
        image: "alpine:latest",
        command: ["echo", "hi"],
        timeoutMs: 999999,
      })
    ).rejects.toThrow();
  });

  it("should throw on unknown tool name", async () => {
    await expect(
      sandboxMcp.executeTool("nonexistent-tool", {})
    ).rejects.toThrow(/Unknown tool/);
  });
});
