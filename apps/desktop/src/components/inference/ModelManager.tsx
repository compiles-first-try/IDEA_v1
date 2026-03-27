import { useState } from "react";
import { usePullModel, useTestAnthropic } from "@/hooks/useModels.ts";

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

const TIER_AGENTS: Record<string, string> = {
  TRIVIAL: "Used by: Router Decision, formatting, JSON extraction, simple classification",
  STANDARD: "Used by: Code Generator, Test Generator, Spec Interpreter",
  COMPLEX: "Used by: Consensus Gate, multi-file generation, debugging",
  CRITICAL: "Used by: Adversarial Review, architecture decisions, security review, self-improvement proposals",
};

export function ModelManager({ data }: ModelManagerProps) {
  const [pullModelName, setPullModelName] = useState("");
  const pullModel = usePullModel();
  const testAnthropic = useTestAnthropic();
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handlePull = async () => {
    if (!pullModelName.trim()) return;
    try {
      await pullModel.mutateAsync(pullModelName.trim());
      setPullModelName("");
    } catch {
      // error state available via pullModel.isError
    }
  };

  const handleTestConnection = async () => {
    setTestResult(null);
    try {
      const res = await testAnthropic.mutateAsync();
      const d = res.data;
      setTestResult({ success: d.success, message: d.message ?? d.error ?? "" });
    } catch {
      setTestResult({ success: false, message: "Connection test failed" });
    }
  };

  return (
    <div className="space-y-8">
      {/* Ollama Section */}
      <section>
        <h3 className="mb-3 text-sm font-semibold">Local Models (Ollama)</h3>
        {data.ollama.length === 0 ? (
          <p className="text-xs text-[var(--color-text-secondary)]">No local models found. Pull a model below.</p>
        ) : (
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
        )}
        <div className="mt-3 flex gap-2">
          <input value={pullModelName} onChange={(e) => setPullModelName(e.target.value)} placeholder="Model name (e.g. llama3.3:8b)"
            className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm placeholder:text-[var(--color-text-secondary)]" />
          <button
            aria-label="Pull"
            disabled={!pullModelName.trim() || pullModel.isPending}
            onClick={handlePull}
            className="rounded bg-[var(--color-accent-blue)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-40"
          >
            {pullModel.isPending ? "Pulling..." : "Pull"}
          </button>
        </div>
        {pullModel.isError && (
          <p className="mt-2 text-xs text-[var(--color-accent-red)]">Failed to pull model.</p>
        )}
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
          <button
            aria-label="Test Connection"
            onClick={handleTestConnection}
            disabled={testAnthropic.isPending}
            className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-bg-elevated)] disabled:opacity-40"
          >
            {testAnthropic.isPending ? "Testing..." : "Test Connection"}
          </button>
          {testResult && (
            <p className={`mt-2 text-xs ${testResult.success ? "text-[var(--color-accent-green)]" : "text-[var(--color-accent-red)]"}`}>
              {testResult.message}
            </p>
          )}
        </div>
      </section>

      {/* Model Router Visualization */}
      <section>
        <h3 className="mb-2 text-sm font-semibold">Model Router</h3>
        <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
          Every task is classified by complexity before execution. The router assigns it to a tier, which determines which model runs and at what cost. Config spend limits can force downgrade to cheaper tiers.
        </p>
        <div className="space-y-2">
          {data.routerTiers.map((t) => (
            <div key={t.tier} className="rounded border border-[var(--color-border)] p-3">
              <div className="flex items-center gap-4">
                <span className="w-20 text-xs font-semibold">{t.tier}</span>
                <span className="flex-1 text-xs">{t.model}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">{t.costPerCall}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">{t.callsToday} calls today</span>
              </div>
              <div className="mt-1.5 text-[10px] text-[var(--color-text-secondary)]">
                {TIER_AGENTS[t.tier] ?? "General-purpose tasks"}
              </div>
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
