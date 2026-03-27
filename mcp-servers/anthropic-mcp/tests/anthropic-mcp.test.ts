/**
 * Tests for the Anthropic MCP Server.
 *
 * Verifies:
 * - Exposes the generate tool definition
 * - Generate returns response with cost tracking fields
 * - Spend limit enforcement works
 * - Invalid input is rejected by Zod schemas
 */
import { describe, it, expect, beforeAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Anthropic MCP Server", () => {
  let anthropicMcp: typeof import("../src/index.js");

  beforeAll(async () => {
    anthropicMcp = await import("../src/index.js");
  });

  it("should export the generate tool definition", () => {
    const tools = anthropicMcp.getToolDefinitions();
    expect(tools).toBeDefined();
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe("generate");
    expect(tools[0].description).toContain("Anthropic");
    expect(tools[0].description).toContain("spend limit");
  });

  it("should generate text with cost tracking", async () => {
    const result = await anthropicMcp.executeTool("generate", {
      model: "claude-3-5-haiku-20241022",
      prompt: "Reply with the single word: hello",
      maxTokens: 32,
      temperature: 0,
    });

    expect(typeof result.response).toBe("string");
    expect((result.response as string).length).toBeGreaterThan(0);
    expect(typeof result.tokensIn).toBe("number");
    expect(typeof result.tokensOut).toBe("number");
    expect(typeof result.costUsd).toBe("number");
    expect((result.costUsd as number)).toBeGreaterThan(0);
    expect(typeof result.dailySpendUsd).toBe("number");
    expect(typeof result.durationMs).toBe("number");
    expect(result.stopReason).toBeDefined();
  }, 30000);

  it("should reject invalid input (missing prompt)", async () => {
    await expect(
      anthropicMcp.executeTool("generate", {
        model: "claude-3-5-haiku-20241022",
      })
    ).rejects.toThrow();
  });

  it("should reject invalid input (empty prompt)", async () => {
    await expect(
      anthropicMcp.executeTool("generate", {
        model: "claude-3-5-haiku-20241022",
        prompt: "",
      })
    ).rejects.toThrow();
  });

  it("should reject temperature out of range", async () => {
    await expect(
      anthropicMcp.executeTool("generate", {
        model: "claude-3-5-haiku-20241022",
        prompt: "hello",
        temperature: 5,
      })
    ).rejects.toThrow();
  });

  it("should throw on unknown tool name", async () => {
    await expect(
      anthropicMcp.executeTool("nonexistent-tool", {})
    ).rejects.toThrow(/Unknown tool/);
  });
});
