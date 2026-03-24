import { useState } from "react";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
  capabilities: string[];
  successRate: number;
  totalRuns: number;
}

interface AgentRosterProps {
  agents: Agent[];
}

type Tab = "search" | "topology" | "matrix";

export function AgentRoster({ agents }: AgentRosterProps) {
  const [tab, setTab] = useState<Tab>("search");
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const filtered = search
    ? agents.filter((a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.capabilities.some((c) => c.toLowerCase().includes(search.toLowerCase()))
      )
    : agents;

  const ROLE_COLORS: Record<string, string> = {
    PRODUCER: "text-[var(--color-accent-blue)]",
    VALIDATOR: "text-[var(--color-accent-purple)]",
    ORCHESTRATOR: "text-[var(--color-accent-green)]",
    PROVISIONER: "text-[var(--color-accent-amber)]",
    OBSERVER: "text-[var(--color-text-secondary)]",
  };

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-2">
        {([["search", "Search"], ["topology", "Topology"], ["matrix", "Matrix"]] as const).map(([key, label]) => (
          <button key={key} aria-label={label} onClick={() => setTab(key)}
            className={`rounded px-3 py-1.5 text-xs ${tab === key ? "bg-[var(--color-accent-blue)] text-white" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]"}`}>
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-2 opacity-50">
          <button disabled className="rounded border border-[var(--color-border)] px-2 py-1 text-[10px]">Define a new agent</button>
          <span className="text-[10px] text-[var(--color-accent-purple)]">Coming in V2</span>
        </div>
      </div>

      {/* Search view */}
      {tab === "search" && (
        <div>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Find agents that can..."
            className="mb-4 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm placeholder:text-[var(--color-text-secondary)]" />
          <div className="space-y-2">
            {filtered.map((a) => (
              <button key={a.id} onClick={() => setSelectedAgent(a)}
                className="flex w-full items-center gap-4 rounded border border-[var(--color-border)] p-3 text-left hover:bg-[var(--color-bg-elevated)]">
                <span className={`inline-block h-2 w-2 rounded-full ${a.status === "ACTIVE" ? "bg-[var(--color-accent-green)]" : "bg-[var(--color-text-secondary)]"}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{a.name}</div>
                  <div className="flex gap-2 text-[10px]">
                    <span className={ROLE_COLORS[a.role] ?? ""}>{a.role}</span>
                    {a.capabilities.slice(0, 3).map((c) => (
                      <span key={c} className="rounded bg-[var(--color-bg-elevated)] px-1.5 py-0.5">{c}</span>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">{(a.successRate * 100).toFixed(0)}%</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Topology view (placeholder — React Flow + Dagre deferred to post-Phase 2) */}
      {tab === "topology" && (
        <div data-testid="topology-view" className="flex h-[400px] items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="text-center text-sm text-[var(--color-text-secondary)]">
            <p>Agent Dependency Graph</p>
            <p className="text-xs">{agents.length} agents • Edges derived from audit log</p>
          </div>
        </div>
      )}

      {/* Matrix view */}
      {tab === "matrix" && (
        <div data-testid="matrix-view" className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="p-2 text-left">Agent</th>
                <th className="p-2 text-left">Role</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-right">Success Rate</th>
                <th className="p-2 text-right">Runs</th>
                <th className="p-2 text-left">Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} onClick={() => setSelectedAgent(a)} className="cursor-pointer border-b border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)]">
                  <td className="p-2 font-medium">{a.name}</td>
                  <td className={`p-2 ${ROLE_COLORS[a.role] ?? ""}`}>{a.role}</td>
                  <td className="p-2">{a.status}</td>
                  <td className="p-2 text-right">{(a.successRate * 100).toFixed(0)}%</td>
                  <td className="p-2 text-right">{a.totalRuns}</td>
                  <td className="p-2">{a.capabilities.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Agent Profile Modal */}
      {selectedAgent && (
        <div data-testid="agent-profile-modal" role="dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[560px] max-h-[80vh] overflow-y-auto rounded-lg bg-[var(--color-bg-elevated)] p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{selectedAgent.name}</h3>
              <button onClick={() => setSelectedAgent(null)} className="text-xs text-[var(--color-text-secondary)]">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div><span className="text-[var(--color-text-secondary)]">ID:</span> {selectedAgent.id}</div>
              <div><span className="text-[var(--color-text-secondary)]">Role:</span> <span className={ROLE_COLORS[selectedAgent.role] ?? ""}>{selectedAgent.role}</span></div>
              <div><span className="text-[var(--color-text-secondary)]">Status:</span> {selectedAgent.status}</div>
              <div><span className="text-[var(--color-text-secondary)]">Success Rate:</span> {(selectedAgent.successRate * 100).toFixed(1)}%</div>
              <div><span className="text-[var(--color-text-secondary)]">Total Runs:</span> {selectedAgent.totalRuns}</div>
              <div><span className="text-[var(--color-text-secondary)]">Capabilities:</span> {selectedAgent.capabilities.join(", ")}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
