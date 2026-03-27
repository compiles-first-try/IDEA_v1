/**
 * Cross-Agent Behavioral Monitor
 *
 * Monitors combined behavioral patterns across all agents.
 * Detects anomalous coordination even when individual actions are in-scope.
 * (SPN F-5: multi-agent collusion defense)
 */
import { describe, it, expect } from "vitest";

describe("Cross-Agent Behavioral Monitor", () => {
  let monitor: typeof import("../src/cross-agent-monitor/index.js");

  it("should load module", async () => {
    monitor = await import("../src/cross-agent-monitor/index.js");
    expect(monitor).toBeDefined();
  });

  it("should track agent actions in a unified log", () => {
    const log = monitor.createBehavioralLog();
    log.record({ agentId: "agent-a", action: "READ", target: "file-1", timestamp: Date.now() });
    log.record({ agentId: "agent-b", action: "WRITE", target: "file-1", timestamp: Date.now() });
    expect(log.getEntries()).toHaveLength(2);
  });

  it("should detect coordination pattern — two agents accessing same resource in sequence", () => {
    const log = monitor.createBehavioralLog();
    const now = Date.now();
    log.record({ agentId: "agent-a", action: "WRITE", target: "shared-state-x", timestamp: now });
    log.record({ agentId: "agent-b", action: "READ", target: "shared-state-x", timestamp: now + 100 });
    log.record({ agentId: "agent-a", action: "WRITE", target: "shared-state-x", timestamp: now + 200 });
    log.record({ agentId: "agent-b", action: "READ", target: "shared-state-x", timestamp: now + 300 });

    const patterns = monitor.detectCoordinationPatterns(log);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].agents).toContain("agent-a");
    expect(patterns[0].agents).toContain("agent-b");
    expect(patterns[0].type).toBe("SEQUENTIAL_ACCESS");
  });

  it("should not flag normal independent activity", () => {
    const log = monitor.createBehavioralLog();
    const now = Date.now();
    log.record({ agentId: "agent-a", action: "READ", target: "file-a", timestamp: now });
    log.record({ agentId: "agent-b", action: "READ", target: "file-b", timestamp: now + 100 });

    const patterns = monitor.detectCoordinationPatterns(log);
    expect(patterns).toHaveLength(0);
  });

  it("should detect frequency anomaly — sudden spike in agent activity", () => {
    const log = monitor.createBehavioralLog();
    const now = Date.now();
    // Normal activity: 1 action per second
    for (let i = 0; i < 5; i++) {
      log.record({ agentId: "agent-a", action: "READ", target: `file-${i}`, timestamp: now + i * 1000 });
    }
    // Spike: 10 actions in 1 second
    for (let i = 0; i < 10; i++) {
      log.record({ agentId: "agent-a", action: "WRITE", target: `rapid-${i}`, timestamp: now + 5000 + i * 50 });
    }

    const anomalies = monitor.detectFrequencyAnomalies(log, { windowMs: 1000, threshold: 5 });
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].agentId).toBe("agent-a");
  });
});
