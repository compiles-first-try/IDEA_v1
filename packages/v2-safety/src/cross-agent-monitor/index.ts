/**
 * Cross-Agent Behavioral Monitor
 *
 * Monitors combined behavioral patterns across all agents.
 * Detects anomalous coordination even when individual actions are in-scope.
 * (SPN F-5: multi-agent collusion defense)
 */

export interface LogEntry {
  agentId: string;
  action: string;
  target: string;
  timestamp: number;
}

export interface BehavioralLog {
  record(entry: LogEntry): void;
  getEntries(): LogEntry[];
}

export interface CoordinationPattern {
  agents: string[];
  target: string;
  type: "SEQUENTIAL_ACCESS";
  count: number;
}

export interface FrequencyAnomaly {
  agentId: string;
  windowStart: number;
  count: number;
  threshold: number;
}

export function createBehavioralLog(): BehavioralLog {
  const entries: LogEntry[] = [];
  return {
    record(entry: LogEntry) {
      entries.push(entry);
    },
    getEntries() {
      return [...entries];
    },
  };
}

export function detectCoordinationPatterns(log: BehavioralLog): CoordinationPattern[] {
  const entries = log.getEntries();
  const patterns: CoordinationPattern[] = [];

  // Group entries by target
  const byTarget = new Map<string, LogEntry[]>();
  for (const e of entries) {
    if (!byTarget.has(e.target)) byTarget.set(e.target, []);
    byTarget.get(e.target)!.push(e);
  }

  for (const [target, targetEntries] of byTarget) {
    const sorted = targetEntries.sort((a, b) => a.timestamp - b.timestamp);

    // Look for WRITE then READ by different agent pairs
    const pairCounts = new Map<string, number>();
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];
      if (
        curr.action === "WRITE" &&
        next.action === "READ" &&
        curr.agentId !== next.agentId
      ) {
        const key = [curr.agentId, next.agentId].sort().join("|");
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }

    for (const [key, count] of pairCounts) {
      if (count >= 2) {
        const agents = key.split("|");
        patterns.push({
          agents,
          target,
          type: "SEQUENTIAL_ACCESS",
          count,
        });
      }
    }
  }

  return patterns;
}

export function detectFrequencyAnomalies(
  log: BehavioralLog,
  opts: { windowMs: number; threshold: number }
): FrequencyAnomaly[] {
  const entries = log.getEntries();
  const anomalies: FrequencyAnomaly[] = [];

  // Group by agent
  const byAgent = new Map<string, LogEntry[]>();
  for (const e of entries) {
    if (!byAgent.has(e.agentId)) byAgent.set(e.agentId, []);
    byAgent.get(e.agentId)!.push(e);
  }

  for (const [agentId, agentEntries] of byAgent) {
    const sorted = agentEntries.sort((a, b) => a.timestamp - b.timestamp);
    if (sorted.length === 0) continue;

    const minTs = sorted[0].timestamp;
    const maxTs = sorted[sorted.length - 1].timestamp;

    // Slide window across the time range
    for (let windowStart = minTs; windowStart <= maxTs; windowStart += Math.floor(opts.windowMs / 2)) {
      const windowEnd = windowStart + opts.windowMs;
      const count = sorted.filter(
        (e) => e.timestamp >= windowStart && e.timestamp < windowEnd
      ).length;

      if (count > opts.threshold) {
        // Avoid duplicate reports for overlapping windows with same start agent
        const alreadyReported = anomalies.some(
          (a) => a.agentId === agentId && Math.abs(a.windowStart - windowStart) < opts.windowMs
        );
        if (!alreadyReported) {
          anomalies.push({ agentId, windowStart, count, threshold: opts.threshold });
        }
      }
    }
  }

  return anomalies;
}
