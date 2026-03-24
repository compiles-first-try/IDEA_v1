import { useState } from "react";
import { z } from "zod";

const ConfigSchema = z.object({
  maxDailySpendUsd: z.number().positive("Spend limit must be positive"),
  autonomyLevel: z.enum(["autonomous", "supervised", "manual"]),
});

interface ConfigData {
  maxDailySpendUsd: number;
  autonomyLevel: "autonomous" | "supervised" | "manual";
}

interface ConfigPanelProps {
  config: ConfigData;
  onSave: (config: ConfigData) => Promise<void>;
}

export function ConfigPanel({ config, onSave }: ConfigPanelProps) {
  const [spend, setSpend] = useState(String(config.maxDailySpendUsd));
  const [autonomy, setAutonomy] = useState(config.autonomyLevel);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    const result = ConfigSchema.safeParse({
      maxDailySpendUsd: parseFloat(spend),
      autonomyLevel: autonomy,
    });

    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    await onSave(result.data);
  };

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="daily-spend"
          className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]"
        >
          Max Daily Spend (USD)
        </label>
        <input
          id="daily-spend"
          type="number"
          value={spend}
          onChange={(e) => setSpend(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label
          htmlFor="autonomy-level"
          className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]"
        >
          Autonomy Level
        </label>
        <select
          id="autonomy-level"
          value={autonomy}
          onChange={(e) =>
            setAutonomy(e.target.value as ConfigData["autonomyLevel"])
          }
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm"
        >
          <option value="supervised">Supervised</option>
          <option value="autonomous">Autonomous</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {error && (
        <p className="text-xs text-[var(--color-accent-red)]">{error}</p>
      )}

      <button
        onClick={handleSave}
        className="rounded bg-[var(--color-accent-blue)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        aria-label="Save"
      >
        Save
      </button>
    </div>
  );
}
