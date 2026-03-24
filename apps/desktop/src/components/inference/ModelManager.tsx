import { useState } from "react";

interface OllamaModel {
  name: string;
  size: string;
  lastUsed: string;
}

interface RouterTier {
  tier: string;
  model: string;
  costPerCall: string;
  callsToday: number;
}

interface ModelManagerData {
  ollama: OllamaModel[];
  anthropicKeySet: boolean;
  anthropicModels: string[];
  routerTiers: RouterTier[];
}

interface ModelManagerProps {
  data: ModelManagerData;
}

export function ModelManager({ data }: ModelManagerProps) {
  const [pullModel, setPullModel] = useState("");

  return (
    <div className="space-y-8">
      {/* Ollama Section */}
      <section>
        <h3 className="mb-3 text-sm font-semibold">Local Models (Ollama)</h3>
        <div className="space-y-2">
          {data.ollama.map((m) => (
            <div key={m.name} className="flex items-center justify-between rounded border border-[var(--color-border)] p-3">
              <div>
                <div className="text-sm font-medium">{m.name}</div>
                <div className="text-[10px] text-[var(--color-text-secondary)]">{m.size} • Last used: {m.lastUsed}</div>
              </div>
              <button className="rounded border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-accent-red)] hover:bg-[var(--color-bg-elevated)]">Remove</button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input value={pullModel} onChange={(e) => setPullModel(e.target.value)} placeholder="Model name (e.g. llama3.3:8b)"
            className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm placeholder:text-[var(--color-text-secondary)]" />
          <button aria-label="Pull" disabled={!pullModel.trim()}
            className="rounded bg-[var(--color-accent-blue)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40">Pull</button>
        </div>
      </section>

      {/* Anthropic Section */}
      <section>
        <h3 className="mb-3 text-sm font-semibold">Anthropic API</h3>
        <div className="rounded border border-[var(--color-border)] p-3">
          <div className="mb-2 text-xs">
            <span className="text-[var(--color-text-secondary)]">API Key: </span>
            <span className={data.anthropicKeySet ? "text-[var(--color-accent-green)]" : "text-[var(--color-accent-red)]"}>
              {data.anthropicKeySet ? "Set" : "Not set"}
            </span>
          </div>
          <div className="mb-3 text-xs text-[var(--color-text-secondary)]">
            Models: {data.anthropicModels.join(", ")}
          </div>
          <button aria-label="Test Connection"
            className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-bg-elevated)]">Test Connection</button>
        </div>
      </section>

      {/* Model Router Visualization */}
      <section>
        <h3 className="mb-3 text-sm font-semibold">Model Router</h3>
        <div className="space-y-2">
          {data.routerTiers.map((t) => (
            <div key={t.tier} className="flex items-center gap-4 rounded border border-[var(--color-border)] p-3">
              <span className="w-20 text-xs font-semibold">{t.tier}</span>
              <span className="flex-1 text-xs">{t.model}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">{t.costPerCall}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">{t.callsToday} calls</span>
            </div>
          ))}
        </div>
      </section>

      {/* V3 Placeholder */}
      <section className="flex items-center justify-between rounded border border-[var(--color-border)] p-3 opacity-50">
        <div>
          <span className="text-xs font-medium">Fine-Tuning</span>
          <p className="text-[10px] text-[var(--color-text-secondary)]">Train on system data — requires sufficient training data volume</p>
        </div>
        <span className="text-[10px] text-[var(--color-accent-purple)]">Coming in V3</span>
      </section>
    </div>
  );
}
