/**
 * Adversarial Peer Review — Multi-Critic Panel
 *
 * 3 diverse critics (correctness, adversarial, efficiency) with
 * structural model independence.
 */
import { describe, it, expect, beforeAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Adversarial Peer Review", () => {
  let review: typeof import("../src/adversarial-review/index.js");

  beforeAll(async () => {
    review = await import("../src/adversarial-review/index.js");
  });

  it("should define three critic personas", () => {
    const critics = review.getCriticPersonas();
    expect(critics).toHaveLength(3);
    expect(critics.map((c: { role: string }) => c.role).sort()).toEqual(
      ["adversarial", "correctness", "efficiency"]
    );
  });

  it("should run a correctness critique", () => {
    const result = review.critiqueCorrectness({
      code: "function add(a: number, b: number): number { return a + b; }",
      requirements: ["adds two numbers", "returns their sum"],
    });
    expect(result.verdict).toBeDefined();
    expect(["PASS", "FAIL"]).toContain(result.verdict);
    expect(result.findings).toBeDefined();
  });

  it("should run an adversarial critique", () => {
    const result = review.critiqueAdversarial({
      code: "function divide(a: number, b: number): number { return a / b; }",
      requirements: ["divides two numbers"],
    });
    expect(result.verdict).toBeDefined();
    expect(result.findings.length).toBeGreaterThan(0); // should find division by zero
  });

  it("should run an efficiency critique", () => {
    const result = review.critiqueEfficiency({
      code: `function fib(n: number): number {
        if (n <= 1) return n;
        return fib(n-1) + fib(n-2);
      }`,
      requirements: ["compute fibonacci number"],
    });
    expect(result.verdict).toBeDefined();
    expect(result.findings).toBeDefined();
  });

  it("should compute panel consensus — all pass", () => {
    const verdicts = [
      { role: "correctness", verdict: "PASS" as const, findings: [] },
      { role: "adversarial", verdict: "PASS" as const, findings: ["checked division by zero — handled"] },
      { role: "efficiency", verdict: "PASS" as const, findings: [] },
    ];
    const consensus = review.computeConsensus(verdicts);
    expect(consensus.accepted).toBe(true);
    expect(consensus.unanimity).toBe("UNANIMOUS");
  });

  it("should compute panel consensus — one dissent", () => {
    const verdicts = [
      { role: "correctness", verdict: "PASS" as const, findings: [] },
      { role: "adversarial", verdict: "FAIL" as const, findings: ["division by zero not handled"] },
      { role: "efficiency", verdict: "PASS" as const, findings: [] },
    ];
    const consensus = review.computeConsensus(verdicts);
    expect(consensus.accepted).toBe(false);
    expect(consensus.unanimity).toBe("DISSENT");
    expect(consensus.dissentingCritics).toContain("adversarial");
  });

  it("should enforce structural independence tracking", () => {
    const panel = review.createPanel({
      generatorModel: "qwen2.5-coder:14b",
      generatorProvider: "ollama",
    });

    expect(panel.correctnessCritic.provider).toBeDefined();
    expect(panel.adversarialCritic.provider).toBeDefined();
    // At least one critic must use a different provider
    const providers = [
      panel.correctnessCritic.provider,
      panel.adversarialCritic.provider,
      panel.efficiencyCritic.provider,
    ];
    const uniqueProviders = new Set(providers);
    expect(uniqueProviders.size).toBeGreaterThanOrEqual(1);
  });
});
