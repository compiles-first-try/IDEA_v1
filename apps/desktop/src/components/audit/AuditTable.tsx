import { useState } from "react";

interface AuditEvent {
  id: number;
  event_id: string;
  timestamp: string;
  agent_id: string;
  agent_type: string;
  action_type: string;
  phase: string | null;
  status: string;
  model_used: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  duration_ms: number | null;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error_message: string | null;
  reasoning_trace?: string | null;
}

interface Filters {
  agentId?: string;
  actionType?: string;
  status?: string;
}

interface AuditTableProps {
  events: AuditEvent[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  onFilterChange: (filters: Filters) => void;
}

export function AuditTable({ events, total, page, onPageChange, onFilterChange }: AuditTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const updateFilter = (key: keyof Filters, value: string) => {
    const next = { ...filters, [key]: value || undefined };
    setFilters(next);
    onFilterChange(next);
  };

  const exportCsv = () => {
    const header = "timestamp,agent,action,model,tokens_in,tokens_out,duration_ms,status,error_message\n";
    const rows = events.map((e) => {
      const err = (e.error_message ?? "").replace(/"/g, '""');
      return `${e.timestamp},${e.agent_id},${e.action_type},${e.model_used ?? ""},${e.tokens_in ?? ""},${e.tokens_out ?? ""},${e.duration_ms ?? ""},${e.status},"${err}"`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-events.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <input placeholder="Filter by agent..." value={filters.agentId ?? ""} onChange={(e) => updateFilter("agentId", e.target.value)}
          className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-1 text-xs" />
        <input placeholder="Filter by action..." value={filters.actionType ?? ""} onChange={(e) => updateFilter("actionType", e.target.value)}
          className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-1 text-xs" />
        <select value={filters.status ?? ""} onChange={(e) => updateFilter("status", e.target.value)}
          className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-1 text-xs">
          <option value="">All statuses</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILURE">FAILURE</option>
          <option value="TIMEOUT">TIMEOUT</option>
        </select>
        <div className="flex-1" />
        <button onClick={exportCsv} aria-label="Export CSV"
          className="rounded border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-elevated)]">Export CSV</button>
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left">
              <th className="p-2">Timestamp</th>
              <th className="p-2">Agent</th>
              <th className="p-2">Action</th>
              <th className="p-2">Model</th>
              <th className="p-2 text-right">Tokens</th>
              <th className="p-2 text-right">Duration</th>
              <th className="p-2">Status</th>
              <th className="p-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <>
                <tr key={e.event_id} onClick={() => setExpandedId(expandedId === e.event_id ? null : e.event_id)}
                  className="cursor-pointer border-b border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)]">
                  <td className="p-2">{new Date(e.timestamp).toLocaleTimeString("en-GB")}</td>
                  <td className="p-2">{e.agent_id}</td>
                  <td className="p-2">{e.action_type}</td>
                  <td className="p-2">{e.model_used ?? "—"}</td>
                  <td className="p-2 text-right">{e.tokens_in ?? "—"}/{e.tokens_out ?? "—"}</td>
                  <td className="p-2 text-right">{e.duration_ms != null ? `${e.duration_ms}ms` : "—"}</td>
                  <td className={`p-2 ${e.status === "SUCCESS" ? "text-[var(--color-accent-green)]" : e.status === "FAILURE" ? "text-[var(--color-accent-red)]" : ""}`}>{e.status}</td>
                  <td className="p-2 text-[var(--color-accent-red)]">{e.error_message ?? ""}</td>
                </tr>
                {expandedId === e.event_id && (
                  <tr key={`${e.event_id}-detail`}>
                    <td colSpan={8} className="bg-[var(--color-bg-secondary)] p-3">
                      <div data-testid={`event-detail-${e.event_id}`} className="space-y-2 text-[10px]">
                        {e.reasoning_trace && (
                          <div className="rounded bg-[var(--color-accent-blue)]/10 border border-[var(--color-accent-blue)]/20 p-2">
                            <span className="font-semibold text-[var(--color-accent-blue)]">Reasoning:</span>
                            <p className="mt-1 whitespace-pre-wrap text-[var(--color-text-primary)]">{e.reasoning_trace}</p>
                          </div>
                        )}
                        {e.inputs && <div><span className="font-semibold">Inputs:</span> <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(e.inputs, null, 2)}</pre></div>}
                        {e.outputs && <div><span className="font-semibold">Outputs:</span> <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(e.outputs, null, 2)}</pre></div>}
                        {e.error_message && <div className="text-[var(--color-accent-red)]"><span className="font-semibold">Error:</span> {e.error_message}</div>}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
        <span>Page {page} of {totalPages} ({total} events)</span>
        <div className="flex gap-2">
          <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous"
            className="rounded border border-[var(--color-border)] px-2 py-1 disabled:opacity-40">Prev</button>
          <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Next"
            className="rounded border border-[var(--color-border)] px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}
