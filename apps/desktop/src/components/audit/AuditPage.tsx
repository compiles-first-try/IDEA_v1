import { useState } from "react";
import { AuditStreamFull } from "./AuditStreamFull.tsx";
import { AuditTable } from "./AuditTable.tsx";
import { WS_URL } from "@/api/client.ts";
import { useAuditHistory } from "@/hooks/useAuditHistory.ts";

type Tab = "stream" | "history";

interface AuditFilters {
  agentId?: string;
  actionType?: string;
  status?: string;
}

export function AuditPage() {
  const [tab, setTab] = useState<Tab>("stream");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AuditFilters>({});

  const { events, total, isLoading } = useAuditHistory({ page, ...filters });

  const handleFilterChange = (next: AuditFilters) => {
    setFilters(next);
    setPage(1); // reset to page 1 on filter change
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        <button
          aria-label="Live Stream"
          onClick={() => setTab("stream")}
          className={`rounded px-3 py-1.5 text-xs ${tab === "stream" ? "bg-[var(--color-accent-blue)] text-white" : "text-[var(--color-text-secondary)]"}`}
        >
          Live Stream
        </button>
        <button
          aria-label="History"
          onClick={() => setTab("history")}
          className={`rounded px-3 py-1.5 text-xs ${tab === "history" ? "bg-[var(--color-accent-blue)] text-white" : "text-[var(--color-text-secondary)]"}`}
        >
          History
        </button>
      </div>

      {tab === "stream" && <AuditStreamFull wsUrl={WS_URL} />}
      {tab === "history" && (
        <>
          {isLoading && <p className="text-xs text-[var(--color-text-secondary)]">Loading audit events...</p>}
          <AuditTable
            events={events}
            total={total}
            page={page}
            onPageChange={setPage}
            onFilterChange={handleFilterChange}
          />
        </>
      )}
    </div>
  );
}
