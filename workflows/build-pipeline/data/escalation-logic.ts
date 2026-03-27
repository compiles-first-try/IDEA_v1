/**
 * Confidence-Based Escalation Logic
 *
 * DETERMINISTIC function — no LLM involved.
 * Connects V2's epistemic uncertainty tracking (Rule 16) to the
 * three-tier routing architecture from ROUTING_CLAUDE.md.
 */

export interface UncertaintyEnvelope {
  epistemic: number;   // 0-1, resolvable with more data
  aleatoric: number;   // 0-1, inherent randomness
  method: string;
  disagreement_points: string[];
  knowledge_gaps: string[];
}

export interface EscalationDecision {
  action: "PROCEED" | "ESCALATE" | "SEEK_INFORMATION" | "HALT_FOR_HUMAN";
  reason: string;
  target_tier?: 2 | 3;
}

export function decideEscalation(
  current_tier: 1 | 2 | 3,
  uncertainty: UncertaintyEnvelope,
  gate_passed: boolean
): EscalationDecision {
  // Gate failure always escalates (if not already at Tier 3)
  if (!gate_passed && current_tier < 3) {
    return {
      action: "ESCALATE",
      reason: `Quality gate failed at Tier ${current_tier}`,
      target_tier: (current_tier + 1) as 2 | 3,
    };
  }

  // Gate failure at Tier 3 → human review
  if (!gate_passed && current_tier === 3) {
    return {
      action: "HALT_FOR_HUMAN",
      reason: "Quality gate failed at highest tier",
    };
  }

  // High epistemic uncertainty → seek information first
  if (uncertainty.epistemic > 0.6 && uncertainty.aleatoric < 0.3) {
    return {
      action: "SEEK_INFORMATION",
      reason:
        `High epistemic uncertainty (${uncertainty.epistemic}). ` +
        `Knowledge gaps: ${uncertainty.knowledge_gaps.join(", ")}`,
    };
  }

  // High both → halt
  if (uncertainty.epistemic > 0.5 && uncertainty.aleatoric > 0.5) {
    return {
      action: "HALT_FOR_HUMAN",
      reason: "Both epistemic and aleatoric uncertainty are high — insufficient basis for action",
    };
  }

  // Moderate epistemic at Tier 1/2 → escalate
  if (uncertainty.epistemic > 0.35 && current_tier < 3) {
    return {
      action: "ESCALATE",
      reason: `Epistemic uncertainty ${uncertainty.epistemic} exceeds tier ${current_tier} threshold`,
      target_tier: (current_tier + 1) as 2 | 3,
    };
  }

  return { action: "PROCEED", reason: "Uncertainty within acceptable bounds" };
}
