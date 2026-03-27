/**
 * Behavioral Drift Detector
 *
 * Measures whether agents degrade over extended interactions.
 * Tracks an Agent Stability Index per agent.
 * (Source: Agent Behavioral Contracts drift detection research)
 */
import { describe, it, expect } from "vitest";

describe("Behavioral Drift Detector", () => {
  let drift: typeof import("../src/drift-detector/index.js");

  it("should load module", async () => {
    drift = await import("../src/drift-detector/index.js");
    expect(drift).toBeDefined();
  });

  it("should compute stability index from success rate history", () => {
    const history = [0.95, 0.93, 0.94, 0.92, 0.91, 0.90, 0.88, 0.85];
    const index = drift.computeStabilityIndex(history);
    expect(index.value).toBeDefined();
    expect(index.trend).toBe("DECLINING");
    expect(index.value).toBeLessThan(1.0);
  });

  it("should detect stable agent", () => {
    const history = [0.92, 0.93, 0.91, 0.92, 0.93, 0.92, 0.91, 0.93];
    const index = drift.computeStabilityIndex(history);
    expect(index.trend).toBe("STABLE");
  });

  it("should detect improving agent", () => {
    const history = [0.70, 0.75, 0.78, 0.82, 0.85, 0.88, 0.91, 0.93];
    const index = drift.computeStabilityIndex(history);
    expect(index.trend).toBe("IMPROVING");
  });

  it("should flag drift when stability drops below threshold", () => {
    const history = [0.95, 0.90, 0.82, 0.75, 0.60, 0.45];
    const alert = drift.checkDriftAlert(history, { threshold: 0.7 });
    expect(alert.drifting).toBe(true);
    expect(alert.severity).toBe("HIGH");
  });

  it("should not flag when above threshold", () => {
    const history = [0.92, 0.91, 0.93, 0.92];
    const alert = drift.checkDriftAlert(history, { threshold: 0.7 });
    expect(alert.drifting).toBe(false);
  });

  it("should track per-agent stability over time", () => {
    const tracker = drift.createDriftTracker();
    tracker.recordSuccess("agent-1", true);
    tracker.recordSuccess("agent-1", true);
    tracker.recordSuccess("agent-1", false);
    tracker.recordSuccess("agent-1", true);

    const rate = tracker.getSuccessRate("agent-1");
    expect(rate).toBeCloseTo(0.75, 2);
  });
});
