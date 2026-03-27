interface ParetoDataPoint {
  eventId: string;
  taskTier: number;
  costUsd: number;
  qualityScore: number;
  cacheHit: boolean;
  agentId: string;
}

interface ParetoChartProps {
  data: ParetoDataPoint[];
}

const TIER_COLORS: Record<number, string> = {
  1: "bg-[var(--color-accent-green)]",
  2: "bg-[var(--color-accent-amber)]",
  3: "bg-[var(--color-accent-red)]",
};

export function ParetoChart({ data }: ParetoChartProps) {
  if (data.length === 0) {
    return (
      <div data-testid="pareto-chart" className="flex h-[300px] items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <span className="text-sm text-[var(--color-text-secondary)]">No data yet — run the pipeline to generate Pareto data</span>
      </div>
    );
  }

  const cached = data.filter((d) => d.cacheHit).length;
  const maxCost = Math.max(...data.map((d) => d.costUsd), 0.001);

  return (
    <div data-testid="pareto-chart" className="space-y-3">
      {/* Chart area */}
      <div className="relative h-[250px] rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <div className="absolute bottom-2 left-12 text-[9px] text-[var(--color-text-secondary)]">Cost (USD) →</div>
        <div className="absolute left-2 top-12 -rotate-90 text-[9px] text-[var(--color-text-secondary)]">Quality →</div>
        {/* Scatter points */}
        <div className="relative h-full w-full">
          {data.map((d) => {
            const x = (d.costUsd / maxCost) * 90 + 5;
            const y = (1 - d.qualityScore) * 80 + 5;
            return (
              <div
                key={d.eventId}
                className={`absolute h-2.5 w-2.5 ${d.cacheHit ? "rotate-45" : "rounded-full"} ${TIER_COLORS[d.taskTier] ?? "bg-[var(--color-text-secondary)]"}`}
                style={{ left: `${x}%`, top: `${y}%` }}
                title={`${d.agentId}: cost=$${d.costUsd.toFixed(4)} quality=${d.qualityScore.toFixed(2)} tier=${d.taskTier}${d.cacheHit ? " (cached)" : ""}`}
              />
            );
          })}
        </div>
      </div>

      {/* Legend + stats */}
      <div className="flex items-center gap-4 text-[10px]">
        <div className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent-green)]" /> Tier 1</div>
        <div className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent-amber)]" /> Tier 2</div>
        <div className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent-red)]" /> Tier 3</div>
        <div className="flex-1" />
        <span className="text-[var(--color-text-secondary)]">{data.length} data points</span>
        <span className="text-[var(--color-text-secondary)]">{cached} cached</span>
      </div>
    </div>
  );
}
