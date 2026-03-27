interface UncertaintyDisplayProps {
  epistemic: number;
  aleatoric: number;
  action: string;
}

const ACTION_STYLES: Record<string, string> = {
  PROCEED: "text-[var(--color-accent-green)]",
  SEEK_INFORMATION: "text-[var(--color-accent-amber)]",
  FLAG_HUMAN: "text-[var(--color-accent-amber)]",
  HALT: "text-[var(--color-accent-red)]",
};

export function UncertaintyDisplay({ epistemic, aleatoric, action }: UncertaintyDisplayProps) {
  return (
    <div className="space-y-2 rounded border border-[var(--color-border)] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Epistemic Uncertainty</span>
        <span className="text-xs">{epistemic.toFixed(2)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
        <div data-testid="uncertainty-bar" className="h-full rounded-full bg-[var(--color-accent-blue)]" style={{ width: `${epistemic * 100}%` }} />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Aleatoric Uncertainty</span>
        <span className="text-xs">{aleatoric.toFixed(2)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
        <div data-testid="uncertainty-bar" className="h-full rounded-full bg-[var(--color-accent-purple)]" style={{ width: `${aleatoric * 100}%` }} />
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-[var(--color-text-secondary)]">Recommended Action</span>
        <span className={`text-xs font-semibold ${ACTION_STYLES[action] ?? ""}`}>{action}</span>
      </div>
    </div>
  );
}
