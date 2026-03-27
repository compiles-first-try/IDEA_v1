/**
 * Epistemic Tracking — Uncertainty Envelopes
 *
 * Every LLM output carries epistemic + aleatoric uncertainty scores
 * measured via cross-model disagreement.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Epistemic Tracking", () => {
  let epistemic: typeof import("../src/epistemic-tracking/index.js");

  beforeAll(async () => {
    epistemic = await import("../src/epistemic-tracking/index.js");
  });

  it("should measure cross-model disagreement", () => {
    const responses = [
      { model: "model-a", output: "function add(a, b) { return a + b; }" },
      { model: "model-b", output: "function add(a, b) { return a + b; }" },
    ];
    const result = epistemic.measureDisagreement(responses);
    expect(result.epistemicUncertainty).toBeCloseTo(0, 1); // agreement = low uncertainty
    expect(result.aleatoricUncertainty).toBeDefined();
  });

  it("should detect high epistemic uncertainty from disagreement", () => {
    const responses = [
      { model: "model-a", output: "function add(a, b) { return a + b; }" },
      { model: "model-b", output: "const add = (a, b) => a + b;" },
      { model: "model-c", output: "function sum(x, y) { return x + y; }" },
    ];
    const result = epistemic.measureDisagreement(responses);
    expect(result.epistemicUncertainty).toBeGreaterThan(0);
  });

  it("should create an uncertainty envelope", () => {
    const envelope = epistemic.createEnvelope({
      output: "function add(a, b) { return a + b; }",
      epistemicUncertainty: 0.15,
      aleatoricUncertainty: 0.05,
      modelsConsulted: ["qwen2.5-coder:14b", "claude-haiku"],
      disagreementPoints: [],
      knowledgeGaps: [],
    });

    expect(envelope.output).toBeDefined();
    expect(envelope.uncertainty.epistemic).toBe(0.15);
    expect(envelope.uncertainty.aleatoric).toBe(0.05);
    expect(envelope.uncertainty.modelsConsulted).toHaveLength(2);
  });

  it("should recommend PROCEED for low uncertainty", () => {
    const action = epistemic.recommendAction(0.1, 0.05);
    expect(action).toBe("PROCEED");
  });

  it("should recommend SEEK_INFORMATION for high epistemic uncertainty", () => {
    const action = epistemic.recommendAction(0.7, 0.1);
    expect(action).toBe("SEEK_INFORMATION");
  });

  it("should recommend FLAG_HUMAN for high aleatoric uncertainty", () => {
    const action = epistemic.recommendAction(0.1, 0.7);
    expect(action).toBe("FLAG_HUMAN");
  });

  it("should recommend HALT for both uncertainties high", () => {
    const action = epistemic.recommendAction(0.7, 0.7);
    expect(action).toBe("HALT");
  });
});
