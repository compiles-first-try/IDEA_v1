/**
 * Behavioral Drift Detector
 *
 * Measures whether agents degrade over extended interactions.
 * Tracks an Agent Stability Index per agent.
 * (Source: Agent Behavioral Contracts drift detection research)
 */

export interface StabilityIndex {
  value: number;
  trend: "DECLINING" | "STABLE" | "IMPROVING";
}

export interface DriftAlert {
  drifting: boolean;
  severity?: "LOW" | "MEDIUM" | "HIGH";
}

export interface DriftTracker {
  recordSuccess(agentId: string, success: boolean): void;
  getSuccessRate(agentId: string): number;
}

/**
 * Compute linear regression slope over the history array.
 * DECLINING if slope < -0.005, IMPROVING if slope > 0.005, STABLE otherwise.
 */
export function computeStabilityIndex(history: number[]): StabilityIndex {
  const n = history.length;
  // Linear regression: y = a + b*x where x = 0..n-1
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += history[i];
    sumXY += i * history[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  let trend: StabilityIndex["trend"];
  if (slope < -0.005) {
    trend = "DECLINING";
  } else if (slope > 0.005) {
    trend = "IMPROVING";
  } else {
    trend = "STABLE";
  }

  return { value: history[history.length - 1], trend };
}

/**
 * Check if the last entry in history has drifted below threshold.
 * severity: HIGH if < threshold-0.2, MEDIUM if < threshold-0.1, else LOW.
 */
export function checkDriftAlert(history: number[], opts: { threshold: number }): DriftAlert {
  const last = history[history.length - 1];
  if (last >= opts.threshold) {
    return { drifting: false };
  }

  let severity: "LOW" | "MEDIUM" | "HIGH";
  if (last < opts.threshold - 0.2) {
    severity = "HIGH";
  } else if (last < opts.threshold - 0.1) {
    severity = "MEDIUM";
  } else {
    severity = "LOW";
  }

  return { drifting: true, severity };
}

export function createDriftTracker(): DriftTracker {
  const records = new Map<string, { successes: number; total: number }>();

  return {
    recordSuccess(agentId: string, success: boolean) {
      if (!records.has(agentId)) {
        records.set(agentId, { successes: 0, total: 0 });
      }
      const r = records.get(agentId)!;
      r.total++;
      if (success) r.successes++;
    },
    getSuccessRate(agentId: string): number {
      const r = records.get(agentId);
      if (!r || r.total === 0) return 0;
      return r.successes / r.total;
    },
  };
}
