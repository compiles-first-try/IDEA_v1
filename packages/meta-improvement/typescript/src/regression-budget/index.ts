/**
 * Regression Budget Manager.
 *
 * Tracks the tradeoff between capability expansion and regression introduction.
 * Blocks improvements that cause net regression or exceed the per-cycle
 * regression budget.
 */

export interface TestDelta {
  /** New tests that now pass (didn't exist before) */
  newPassing: number;
  /** New tests that fail (didn't exist before) */
  newFailing: number;
  /** Previously passing tests that now fail (regressions) */
  previouslyPassingNowFailing: number;
  /** Previously failing tests that now pass (fixes) */
  previouslyFailingNowPassing: number;
}

export interface BudgetDecision {
  allowed: boolean;
  netGain: number;
  regressions: number;
  reason: string;
}

export interface BudgetStatus {
  budget: number;
  used: number;
  remaining: number;
}

interface RegressionBudgetConfig {
  maxRegressionsPerCycle: number;
}

export interface RegressionBudget {
  evaluate: (delta: TestDelta) => BudgetDecision;
  recordUsage: (regressions: number) => void;
  reset: () => void;
  getStatus: () => BudgetStatus;
}

/**
 * Create a regression budget manager.
 *
 * Rules:
 * - Net regression (gains < losses) → always blocked
 * - Regressions exceeding remaining budget → blocked
 * - Otherwise, allowed if net gain is positive
 */
export function createRegressionBudget(
  config: RegressionBudgetConfig
): RegressionBudget {
  let used = 0;
  const budget = config.maxRegressionsPerCycle;

  function evaluate(delta: TestDelta): BudgetDecision {
    const regressions = delta.previouslyPassingNowFailing;
    const gains = delta.newPassing + delta.previouslyFailingNowPassing;
    const losses = delta.newFailing + regressions;
    const netGain = gains - losses;

    // Rule 1: Net regression → always blocked
    if (netGain < 0) {
      return {
        allowed: false,
        netGain,
        regressions,
        reason: `Net regression: gain=${gains}, loss=${losses}, net=${netGain}`,
      };
    }

    // Rule 2: Regressions exceeding remaining budget → blocked
    const remaining = budget - used;
    if (regressions > remaining) {
      return {
        allowed: false,
        netGain,
        regressions,
        reason: `Regressions (${regressions}) exceed remaining budget (${remaining})`,
      };
    }

    return {
      allowed: true,
      netGain,
      regressions,
      reason: `Allowed: net gain=${netGain}, regressions=${regressions} within budget`,
    };
  }

  function recordUsage(regressions: number): void {
    used += regressions;
  }

  function reset(): void {
    used = 0;
  }

  function getStatus(): BudgetStatus {
    return { budget, used, remaining: budget - used };
  }

  return { evaluate, recordUsage, reset, getStatus };
}
