import { useState } from "react";
import { z } from "zod";
import { LOCKED_CONSTITUTION } from "../../../../../packages/orchestration/src/contracts/locked-constitution.ts";

interface ModelTiers {
  TRIVIAL: string;
  STANDARD: string;
  COMPLEX: string;
  CRITICAL: string;
}

interface FullConfig {
  maxDailySpendUsd: number;
  pauseThresholdUsd: number;
  perCallCriticalUsd: number;
  autonomyLevel: "supervised" | "semi-auto" | "full-auto";
  modelTiers: ModelTiers;
}

interface ConfigPanelFullProps {
  config: FullConfig;
  onSave: (config: Partial<FullConfig>) => Promise<void>;
}

const DEFAULT_CONFIGURABLE_PRINCIPLES = [
  "Prefer TypeScript over JavaScript for all generated code",
  "Maximum file size for generated artifacts: 500 lines",
  "Generated code must include JSDoc comments on all exported functions",
];

const SpendSchema = z.object({
  maxDailySpendUsd: z.number().positive("Must be positive"),
  pauseThresholdUsd: z.number().positive("Must be positive"),
});

export function ConfigPanelFull({ config, onSave }: ConfigPanelFullProps) {
  const [softLimit, setSoftLimit] = useState(String(config.maxDailySpendUsd));
  const [hardLimit, setHardLimit] = useState(String(config.pauseThresholdUsd));
  const [autonomy, setAutonomy] = useState(config.autonomyLevel);
  const [error, setError] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    const result = SpendSchema.safeParse({
      maxDailySpendUsd: parseFloat(softLimit),
      pauseThresholdUsd: parseFloat(hardLimit),
    });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    await onSave({ ...result.data, autonomyLevel: autonomy });
  };

  return (
    <div className="space-y-8">
      {/* Spend Limits */}
      <section>
        <h3 className="mb-3 text-sm font-semibold">Spend Limits</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="soft-limit" className="mb-1 block text-xs text-[var(--color-text-secondary)]">Daily Soft Limit (USD)</label>
            <input id="soft-limit" type="number" value={softLimit} onChange={(e) => setSoftLimit(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="hard-limit" className="mb-1 block text-xs text-[var(--color-text-secondary)]">Daily Hard Limit (USD)</label>
            <input id="hard-limit" type="number" value={hardLimit} onChange={(e) => setHardLimit(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm" />
          </div>
        </div>
      </section>

      {/* Autonomy */}
      <section>
        <h3 className="mb-3 text-sm font-semibold">Autonomy</h3>
        <label htmlFor="autonomy-select" className="mb-1 block text-xs text-[var(--color-text-secondary)]">Autonomy Level</label>
        <select id="autonomy-select" value={autonomy} onChange={(e) => setAutonomy(e.target.value as FullConfig["autonomyLevel"])}
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm">
          <option value="supervised">Supervised</option>
          <option value="semi-auto">Semi-Auto</option>
          <option value="full-auto">Full-Auto</option>
        </select>
      </section>

      {error && <p className="text-xs text-[var(--color-accent-red)]">{error}</p>}
      <button onClick={handleSave} aria-label="Save" className="rounded bg-[var(--color-accent-blue)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Save</button>

      {/* Locked Constitution — Tier 1 */}
      <section className="rounded-lg bg-[var(--color-bg-elevated)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">System-enforced</span>
          <span className="text-[10px] text-[var(--color-accent-amber)]">🔒 Locked Constitution</span>
        </div>
        <div className="space-y-2">
          {LOCKED_CONSTITUTION.map((p) => (
            <div key={p.id} className="flex items-start gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3">
              <span className="mt-0.5 text-xs">🔒</span>
              <div className="flex-1">
                <p className="text-xs">{p.text}</p>
                <button onClick={() => setInfoModal(p.id)} className="mt-1 text-[10px] text-[var(--color-accent-blue)] hover:underline">Why is this locked?</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Configurable Principles — Tier 2 */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Operator-configured</span>
        </div>
        <div className="space-y-2">
          {DEFAULT_CONFIGURABLE_PRINCIPLES.map((p, i) => (
            <div key={i} className="flex items-start gap-2 rounded border border-[var(--color-border)] p-3">
              <span className="mt-0.5 text-xs">✏️</span>
              <p className="flex-1 text-xs">{p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* V2 Placeholders */}
      <section className="space-y-2">
        {["Policy Engine", "Management Board", "Hallucination Detection"].map((feature) => (
          <div key={feature} className="flex items-center justify-between rounded border border-[var(--color-border)] p-3 opacity-50">
            <span className="text-xs">{feature}</span>
            <span className="text-[10px] text-[var(--color-accent-purple)]">Coming in V2</span>
          </div>
        ))}
      </section>

      {/* Info Modal */}
      {infoModal && (
        <div role="dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[480px] rounded-lg bg-[var(--color-bg-elevated)] p-6 shadow-xl">
            <h3 className="mb-2 text-sm font-semibold">Why is this principle locked?</h3>
            <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
              {LOCKED_CONSTITUTION.find((p) => p.id === infoModal)?.rationale}
            </p>
            <button onClick={() => setInfoModal(null)} className="rounded bg-[var(--color-accent-blue)] px-3 py-1.5 text-xs text-white">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
