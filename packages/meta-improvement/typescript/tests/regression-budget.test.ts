/**
 * Tests for the Regression Budget Manager.
 *
 * Verifies:
 * - Tracks capability expansion (new tests passing) vs regressions (previously passing tests now failing)
 * - Blocks improvements that cause net regression
 * - Allows improvements with zero regressions
 * - Allows improvements where capability gain exceeds regression loss within budget
 * - Tracks budget consumption across improvement cycles
 * - Resets budget per period
 * - Reports budget status
 */
import { describe, it, expect } from "vitest";

describe("Regression Budget Manager", () => {
  let budget: typeof import("../src/regression-budget/index.js");

  it("should load module", async () => {
    budget = await import("../src/regression-budget/index.js");
    expect(budget).toBeDefined();
  });

  it("should allow an improvement with zero regressions", () => {
    const mgr = budget.createRegressionBudget({ maxRegressionsPerCycle: 3 });

    const decision = mgr.evaluate({
      newPassing: 5,
      newFailing: 0,
      previouslyPassingNowFailing: 0,
      previouslyFailingNowPassing: 2,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.netGain).toBe(7); // 5 new + 2 fixed
    expect(decision.regressions).toBe(0);
  });

  it("should allow improvement where gain exceeds regression within budget", () => {
    const mgr = budget.createRegressionBudget({ maxRegressionsPerCycle: 3 });

    const decision = mgr.evaluate({
      newPassing: 10,
      newFailing: 1,
      previouslyPassingNowFailing: 2,
      previouslyFailingNowPassing: 3,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.regressions).toBe(2); // 2 regressions within budget of 3
    expect(decision.netGain).toBeGreaterThan(0);
  });

  it("should block improvement that exceeds regression budget", () => {
    const mgr = budget.createRegressionBudget({ maxRegressionsPerCycle: 2 });

    const decision = mgr.evaluate({
      newPassing: 5,
      newFailing: 0,
      previouslyPassingNowFailing: 3, // 3 regressions > budget of 2
      previouslyFailingNowPassing: 0,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("exceed");
  });

  it("should block improvement with net regression", () => {
    const mgr = budget.createRegressionBudget({ maxRegressionsPerCycle: 10 });

    const decision = mgr.evaluate({
      newPassing: 1,
      newFailing: 5,
      previouslyPassingNowFailing: 3,
      previouslyFailingNowPassing: 0,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.netGain).toBeLessThan(0);
  });

  it("should track cumulative budget consumption", () => {
    const mgr = budget.createRegressionBudget({ maxRegressionsPerCycle: 5 });

    mgr.recordUsage(2);
    mgr.recordUsage(1);

    const status = mgr.getStatus();
    expect(status.used).toBe(3);
    expect(status.remaining).toBe(2);
    expect(status.budget).toBe(5);
  });

  it("should block when cumulative budget is exhausted", () => {
    const mgr = budget.createRegressionBudget({ maxRegressionsPerCycle: 3 });

    mgr.recordUsage(3); // Exhausted

    const decision = mgr.evaluate({
      newPassing: 10,
      newFailing: 0,
      previouslyPassingNowFailing: 1, // Even 1 regression exceeds remaining budget
      previouslyFailingNowPassing: 5,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("budget");
  });

  it("should reset budget", () => {
    const mgr = budget.createRegressionBudget({ maxRegressionsPerCycle: 5 });

    mgr.recordUsage(5);
    expect(mgr.getStatus().remaining).toBe(0);

    mgr.reset();
    expect(mgr.getStatus().remaining).toBe(5);
    expect(mgr.getStatus().used).toBe(0);
  });
});
