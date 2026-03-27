import { describe, it, expect } from "vitest";
import { decideEscalation } from "../escalation-logic.js";

describe("Escalation Logic", () => {
  const lowUncertainty = {
    epistemic: 0.1, aleatoric: 0.05,
    method: "cross-model", disagreement_points: [], knowledge_gaps: [],
  };

  it("should PROCEED when uncertainty is low and gate passed", () => {
    const result = decideEscalation(1, lowUncertainty, true);
    expect(result.action).toBe("PROCEED");
  });

  it("should ESCALATE from Tier 1 to Tier 2 when gate fails", () => {
    const result = decideEscalation(1, lowUncertainty, false);
    expect(result.action).toBe("ESCALATE");
    expect(result.target_tier).toBe(2);
  });

  it("should ESCALATE from Tier 2 to Tier 3 when gate fails", () => {
    const result = decideEscalation(2, lowUncertainty, false);
    expect(result.action).toBe("ESCALATE");
    expect(result.target_tier).toBe(3);
  });

  it("should HALT_FOR_HUMAN when gate fails at Tier 3", () => {
    const result = decideEscalation(3, lowUncertainty, false);
    expect(result.action).toBe("HALT_FOR_HUMAN");
  });

  it("should SEEK_INFORMATION for high epistemic, low aleatoric", () => {
    const result = decideEscalation(2, {
      epistemic: 0.7, aleatoric: 0.2,
      method: "cross-model",
      disagreement_points: ["return type uncertain"],
      knowledge_gaps: ["no training data for this domain"],
    }, true);
    expect(result.action).toBe("SEEK_INFORMATION");
  });

  it("should HALT_FOR_HUMAN for high epistemic AND high aleatoric", () => {
    const result = decideEscalation(2, {
      epistemic: 0.6, aleatoric: 0.6,
      method: "cross-model", disagreement_points: [], knowledge_gaps: [],
    }, true);
    expect(result.action).toBe("HALT_FOR_HUMAN");
  });

  it("should ESCALATE from Tier 2 to Tier 3 for moderate epistemic uncertainty", () => {
    const result = decideEscalation(2, {
      epistemic: 0.4, aleatoric: 0.1,
      method: "cross-model", disagreement_points: [], knowledge_gaps: [],
    }, true);
    expect(result.action).toBe("ESCALATE");
    expect(result.target_tier).toBe(3);
  });
});
