import { useState } from "react";
import { AuditStreamFull } from "./AuditStreamFull.tsx";
import { AuditTable } from "./AuditTable.tsx";
import { WS_URL } from "@/api/client.ts";

type Tab = "stream" | "history";

const MOCK_EVENTS = [
  { id: 1, event_id: "e1", timestamp: "2026-03-24T10:00:00Z", agent_id: "mfg-spec-interpreter", agent_type: "SPEC_INTERPRETER", action_type: "LLM_CALL", phase: "L3", status: "SUCCESS", model_used: "qwen2.5-coder:14b", tokens_in: 228, tokens_out: 464, duration_ms: 16000, inputs: { spec: "Build a calculator" }, outputs: { target: "..." }, error_message: null },
];

export function AuditPage() {
  const [tab, setTab] = useState<Tab>("stream");

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
        <AuditTable
          events={MOCK_EVENTS}
          total={MOCK_EVENTS.length}
          page={1}
          onPageChange={() => {}}
          onFilterChange={() => {}}
        />
      )}
    </div>
  );
}
