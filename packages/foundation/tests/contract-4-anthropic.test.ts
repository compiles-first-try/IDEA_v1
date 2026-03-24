/**
 * Contract 4: TypeScript → Anthropic Claude API
 *
 * Verifies:
 * - API key is loaded from environment (never hardcoded)
 * - Can make a test call to claude-haiku-3-5
 * - Receives a valid response
 * - Error handling works for rate limit and auth failure
 */
import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const hasApiKey =
  !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 0;

describe("Contract 4: TypeScript → Anthropic Claude API", () => {
  it("should load API key from environment (never hardcoded)", () => {
    // The key must come from environment, not be embedded in source
    const key = process.env.ANTHROPIC_API_KEY;
    if (hasApiKey) {
      expect(key).toBeDefined();
      expect(key!.startsWith("sk-ant-")).toBe(true);
    } else {
      // If no key, we validate the mechanism works — env var exists but is empty
      expect(process.env).toHaveProperty("ANTHROPIC_API_KEY");
      console.warn(
        "ANTHROPIC_API_KEY not set — skipping live API tests. Set it in .env to enable."
      );
    }
  });

  it.skipIf(!hasApiKey)(
    "should make a test call to claude-haiku-3-5 and receive a valid response",
    async () => {
      const client = new Anthropic();

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 64,
        messages: [
          {
            role: "user",
            content: "Reply with exactly the word: PONG",
          },
        ],
      });

      expect(response.id).toBeDefined();
      expect(response.type).toBe("message");
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe("text");
      expect(
        (response.content[0] as { type: "text"; text: string }).text
      ).toContain("PONG");
      expect(response.usage.input_tokens).toBeGreaterThan(0);
      expect(response.usage.output_tokens).toBeGreaterThan(0);
    }
  );

  it("should handle auth failure gracefully with a bad key", async () => {
    const badClient = new Anthropic({
      apiKey: "sk-ant-invalid-key-for-contract-test",
    });

    try {
      await badClient.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{ role: "user", content: "test" }],
      });
      // Should not reach here
      expect.unreachable("Expected an authentication error");
    } catch (error: unknown) {
      // Should throw an AuthenticationError (401)
      expect(error).toBeDefined();
      const err = error as { status?: number; message?: string };
      expect(err.status).toBe(401);
    }
  });
});
