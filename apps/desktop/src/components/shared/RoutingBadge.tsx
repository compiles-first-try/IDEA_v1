interface RoutingBadgeProps {
  tier: number;
  classification: string;
  escalated: boolean;
}

const TIER_STYLES: Record<number, string> = {
  1: "bg-[var(--color-accent-green)]",
  2: "bg-[var(--color-accent-amber)]",
  3: "bg-[var(--color-accent-red)]",
};

export function RoutingBadge({ tier, classification, escalated }: RoutingBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        data-testid="tier-badge"
        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold text-white ${TIER_STYLES[tier] ?? "bg-[var(--color-text-secondary)]"}`}
      >
        Tier {tier}
      </span>
      <span className="text-xs text-[var(--color-text-secondary)]">{classification}</span>
      {escalated && (
        <span className="text-[10px] text-[var(--color-accent-amber)]">↑ Escalated</span>
      )}
    </div>
  );
}
