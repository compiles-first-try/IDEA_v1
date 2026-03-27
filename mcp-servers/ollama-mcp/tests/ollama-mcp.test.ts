/**
 * Tests for the Ollama MCP Server.
 *
 * Verifies:
 * - Exposes all 3 tool definitions (generate, list-models, generate-embedding)
 * - Can list available models
 * - Generate returns response with token tracking
 * - Embedding generation returns vectors with correct dimensionality
 * - Invalid input is rejected by Zod schemas
 */
import { describe, it, expect, beforeAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Ollama MCP Server", () => {
  let ollamaMcp: typeof import("../src/index.js");

  beforeAll(async () => {
    ollamaMcp = await import("../src/index.js");
  });

  it("should export all 3 tool definitions", () => {
    const tools = ollamaMcp.getToolDefinitions();
    expect(tools).toBeDefined();
    expect(tools.length).toBe(3);

    const names = tools.map((t) => t.name);
    expect(names).toContain("generate");
    expect(names).toContain("list-models");
    expect(names).toContain("generate-embedding");
  });

  it("should list available models", async () => {
    const result = await ollamaMcp.executeTool("list-models", {});
    expect(result.models).toBeDefined();
    expect(Array.isArray(result.models)).toBe(true);
    expect(typeof result.count).toBe("number");
  }, 15000);

  it("should generate text with token tracking", async () => {
    const result = await ollamaMcp.executeTool("generate", {
      model: "llama3.2:latest",
      prompt: "Say hello in exactly one word.",
      maxTokens: 32,
      temperature: 0,
    });

    expect(typeof result.response).toBe("string");
    expect((result.response as string).length).toBeGreaterThan(0);
    expect(typeof result.tokensIn).toBe("number");
    expect(typeof result.tokensOut).toBe("number");
    expect(typeof result.totalTokens).toBe("number");
    expect(typeof result.durationMs).toBe("number");
    expect(result.done).toBe(true);
  }, 60000);

  it("should generate embeddings with correct dimensions", async () => {
    const result = await ollamaMcp.executeTool("generate-embedding", {
      model: "nomic-embed-text:latest",
      input: "Test embedding generation for vector storage.",
    });

    expect(result.embedding).toBeDefined();
    expect(Array.isArray(result.embedding)).toBe(true);
    expect(typeof result.dimensions).toBe("number");
    expect(result.dimensions).toBeGreaterThan(0);
    expect(typeof result.durationMs).toBe("number");
    expect(typeof result.tokensIn).toBe("number");
  }, 30000);

  it("should reject invalid input for generate (missing prompt)", async () => {
    await expect(
      ollamaMcp.executeTool("generate", {
        model: "llama3.2:latest",
      })
    ).rejects.toThrow();
  });

  it("should reject invalid input for generate (empty model)", async () => {
    await expect(
      ollamaMcp.executeTool("generate", {
        model: "",
        prompt: "hello",
      })
    ).rejects.toThrow();
  });

  it("should reject invalid input for generate-embedding (missing input)", async () => {
    await expect(
      ollamaMcp.executeTool("generate-embedding", {
        model: "nomic-embed-text:latest",
      })
    ).rejects.toThrow();
  });

  it("should throw on unknown tool name", async () => {
    await expect(
      ollamaMcp.executeTool("nonexistent-tool", {})
    ).rejects.toThrow(/Unknown tool/);
  });
});
