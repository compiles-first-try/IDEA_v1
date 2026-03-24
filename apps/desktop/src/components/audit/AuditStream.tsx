import { useEffect, useRef, useState } from "react";

interface AuditStreamProps {
  wsUrl: string;
}

interface AuditLine {
  id: number;
  text: string;
  color: string;
}

let lineId = 0;

function formatEvent(data: Record<string, unknown>): AuditLine {
  const agentId = (data.agent_id as string) ?? "unknown";
  const action = (data.action_type as string) ?? "EVENT";
  const status = (data.status as string) ?? "";
  const dur = data.duration_ms != null ? `${data.duration_ms}ms` : "";
  const ts = new Date().toLocaleTimeString("en-GB");
  const color =
    status === "SUCCESS"
      ? "text-[var(--color-accent-green)]"
      : status === "FAILURE"
        ? "text-[var(--color-accent-red)]"
        : "text-[var(--color-text-secondary)]";

  return {
    id: ++lineId,
    text: `[${ts}] [${agentId}] ${action} ${status} ${dur}`,
    color,
  };
}

export function AuditStream({ wsUrl }: AuditStreamProps) {
  const [lines, setLines] = useState<AuditLine[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "audit_event" && msg.data) {
          const line = formatEvent(msg.data);
          setLines((prev) => [...prev, line]);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    return () => {
      ws.close();
    };
  }, [wsUrl]);

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines]);

  const handleClear = () => {
    setLines([]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          Live Audit Stream
        </span>
        <button
          onClick={handleClear}
          className="rounded border border-[var(--color-border)] px-2 py-1 text-xs"
          aria-label="Clear"
        >
          Clear
        </button>
      </div>
      <div
        data-testid="audit-terminal"
        className="h-[300px] overflow-y-auto rounded bg-black p-3 font-mono text-xs"
      >
        {lines.map((line) => (
          <div key={line.id} className={line.color}>
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
