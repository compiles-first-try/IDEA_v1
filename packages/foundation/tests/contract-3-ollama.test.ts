/**
 * Contract 3: TypeScript → Ollama
 *
 * Verifies:
 * - Can reach localhost:11434
 * - qwen2.5-coder:14b model is available
 * - Can complete a simple prompt and receive a response
 * - Response time < 30s for a 100-token completion
 */
import { describe, it, expect, beforeAll } from "vitest";
import { Ollama } from "ollama";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Contract 3: TypeScript → Ollama", () => {
  let ollama: Ollama;

  beforeAll(() => {
    ollama = new Ollama({
      host: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    });
  });

  it("should reach localhost:11434", async () => {
    const response = await fetch(
      `${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}/api/tags`
    );
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty("models");
  });

  it("should have qwen2.5-coder:14b model available", async () => {
    const list = await ollama.list();
    const modelNames = list.models.map((m) => m.name);
    const hasModel = modelNames.some((name) =>
      name.startsWith("qwen2.5-coder:14b")
    );
    expect(hasModel).toBe(true);
  });

  it("should complete a prompt and respond within 30s", async () => {
    const start = Date.now();

    const response = await ollama.generate({
      model: "qwen2.5-coder:14b",
      prompt: "Write a one-line TypeScript function that adds two numbers.",
      options: {
        num_predict: 100,
      },
    });

    const elapsed = Date.now() - start;

    expect(response.response).toBeDefined();
    expect(response.response.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(30_000);
  });
});
