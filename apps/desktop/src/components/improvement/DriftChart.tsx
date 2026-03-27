interface AgentDrift {
  agentId: string;
  history: number[];
  trend: "DECLINING" | "STABLE" | "IMPROVING";
}

interface DriftChartProps {
  agents: AgentDrift[];
}

const TREND_STYLES: Record<string, { text: string; bg: string }> = {
  DECLINING: { text: "text-[var(--color-accent-red)]", bg: "bg-[var(--color-accent-red)]" },
  STABLE: { text: "text-[var(--color-text-secondary)]", bg: "bg-[var(--color-text-secondary)]" },
  IMPROVING: { text: "text-[var(--color-accent-green)]", bg: "bg-[var(--color-accent-green)]" },
};

export function DriftChart({ agents }: DriftChartProps) {
  if (agents.length === 0) {
    return (
      <div data-testid="drift-chart" className="flex h-[200px] items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <span className="text-sm text-[var(--color-text-secondary)]">No drift data available</span>
      </div>
    );
  }

  return (
    <div data-testid="drift-chart" className="space-y-3">
      <h4 className="text-xs font-semibold">Agent Stability Index</h4>
      <div className="space-y-2">
        {agents.map((agent) => {
          const style = TREND_STYLES[agent.trend];
          const latest = agent.history[agent.history.length - 1] ?? 0;
          return (
            <div
              key={agent.agentId}
              data-trend={agent.trend}
              className={`flex items-center gap-3 rounded border border-[var(--color-border)] p-2 ${agent.trend === "DECLINING" ? "border-[var(--color-accent-red)]" : ""}`}
            >
              <span className="w-24 text-xs font-medium">{agent.agentId}</span>

              {/* Sparkline */}
              <div className="flex flex-1 items-end gap-0.5 h-6">
                {agent.history.map((val, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t ${style.bg} opacity-${30 + Math.floor((i / agent.history.length) * 70)}`}
                    style={{ height: `${val * 100}%`, opacity: 0.3 + (i / agent.history.length) * 0.7 }}
                  />
                ))}
              </div>

              <span className="w-12 text-right text-xs">{(latest * 100).toFixed(0)}%</span>
              <span className={`w-20 text-right text-[10px] font-semibold ${style.text}`}>{agent.trend}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
