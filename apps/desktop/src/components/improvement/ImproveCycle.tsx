import { useState } from "react";

interface Metrics {
  overallScores: number[];
  componentScores: Record<string, number>;
  regressionBudget: { used: number; total: number };
  lastCycle: { timestamp: string; changes: string; delta: number } | null;
}

interface ImproveCycleProps {
  metrics: Metrics;
  onTrigger: () => void;
  running: boolean;
}

export function ImproveCycle({ metrics, onTrigger, running }: ImproveCycleProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const budgetPct = (metrics.regressionBudget.used / metrics.regressionBudget.total) * 100;

  const handleConfirm = () => {
    setShowConfirm(false);
    onTrigger();
  };

  return (
    <div className="space-y-6">
      {/* Quality trend chart */}
      <div data-testid="quality-trend-chart" className="h-[180px] rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <div className="flex h-full items-end gap-1">
          {metrics.overallScores.map((s, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t bg-[var(--color-accent-blue)]" style={{ height: `${s * 140}px` }} />
              <span className="text-[9px] text-[var(--color-text-secondary)]">{s.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-component scores */}
      <section>
        <h4 className="mb-2 text-xs font-semibold">Component Scores</h4>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(metrics.componentScores).map(([name, score]) => (
            <div key={name} className="rounded border border-[var(--color-border)] p-2 text-center">
              <div className="text-sm font-semibold">{(score * 100).toFixed(0)}%</div>
              <div className="text-[10px] text-[var(--color-text-secondary)]">{name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Regression budget */}
      <section>
        <h4 className="mb-2 text-xs font-semibold">Regression Budget</h4>
        <div data-testid="regression-budget" className="space-y-1">
          <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
            <div className="h-full rounded-full bg-[var(--color-accent-amber)]" style={{ width: `${budgetPct}%` }} />
          </div>
          <span className="text-[10px] text-[var(--color-text-secondary)]">{metrics.regressionBudget.used} of {metrics.regressionBudget.total} regressions used</span>
        </div>
      </section>

      {/* Last cycle */}
      {metrics.lastCycle && (
        <div className="rounded border border-[var(--color-border)] p-3 text-xs">
          <span className="text-[var(--color-text-secondary)]">Last cycle:</span>{" "}
          {metrics.lastCycle.changes}{" "}
          <span className="text-[var(--color-accent-green)]">(+{metrics.lastCycle.delta.toFixed(2)})</span>
        </div>
      )}

      {/* Trigger */}
      <button onClick={() => setShowConfirm(true)} disabled={running}
        aria-label={running ? "Running..." : "Run Improvement Cycle"}
        className="rounded bg-[var(--color-accent-blue)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40">
        {running ? "Running..." : "Run Improvement Cycle"}
      </button>

      {/* Confirmation modal */}
      {showConfirm && (
        <div role="dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[420px] rounded-lg bg-[var(--color-bg-elevated)] p-6 shadow-xl">
            <h3 className="mb-2 text-sm font-semibold">Start Improvement Cycle?</h3>
            <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
              This will analyze all recent builds and propose improvements to agent configurations and prompts. Duration: 5–15 minutes.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConfirm(false)} className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs">Cancel</button>
              <button onClick={handleConfirm} className="rounded bg-[var(--color-accent-blue)] px-3 py-1.5 text-xs text-white">Start</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
