import { useEffect, useRef, useState } from "react";

interface AuditStreamFullProps {
  wsUrl: string;
}

interface AuditLine {
  id: number;
  text: string;
  colorClass: string;
}

let lineCounter = 0;

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: "text-[var(--color-accent-green)]",
  FAILURE: "text-[var(--color-accent-red)]",
  TIMEOUT: "text-[var(--color-accent-amber)]",
  DECISION: "text-[var(--color-accent-blue)]",
  KILLED: "text-[var(--color-accent-red)]",
};

function formatEvent(data: Record<string, unknown>): AuditLine {
  const agent = (data.agent_id as string) ?? "unknown";
  const action = (data.action_type as string) ?? "EVENT";
  const status = (data.status as string) ?? "";
  const dur = data.duration_ms != null ? `${data.duration_ms}ms` : "";
  const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
  return {
    id: ++lineCounter,
    text: `[${ts}] [${agent}] ${action} ${status} ${dur}`,
    colorClass: STATUS_COLORS[status] ?? "text-[var(--color-text-secondary)]",
  };
}

export function AuditStreamFull({ wsUrl }: AuditStreamFullProps) {
  const [lines, setLines] = useState<AuditLine[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "audit_event" && msg.data) {
          setLines((prev) => [...prev, formatEvent(msg.data)]);
        }
      } catch { /* ignore malformed */ }
    };
    return () => { ws.close(); };
  }, [wsUrl]);

  useEffect(() => {
    if (autoScroll && typeof bottomRef.current?.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines, autoScroll]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">Live Audit Stream</span>
        <div className="flex gap-2">
          <button
            onClick={() => setAutoScroll((v) => !v)}
            aria-label="Auto-scroll"
            className="rounded border border-[var(--color-border)] px-2 py-1 text-[10px]"
          >
            Auto-scroll: {autoScroll ? "ON" : "OFF"}
          </button>
          <button
            onClick={() => setLines([])}
            aria-label="Clear"
            className="rounded border border-[var(--color-border)] px-2 py-1 text-[10px]"
          >
            Clear
          </button>
        </div>
      </div>
      <div
        data-testid="audit-terminal"
        className="h-[400px] overflow-y-auto rounded bg-black p-3 font-mono text-xs"
      >
        {lines.map((line) => (
          <div key={line.id} className={line.colorClass}>{line.text}</div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
