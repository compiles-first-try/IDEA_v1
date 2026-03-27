import { useEffect, useState, useCallback, useRef } from "react";

export interface AuditLine {
  id: number;
  text: string;
  colorClass: string;
}

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: "text-[var(--color-accent-green)]",
  FAILURE: "text-[var(--color-accent-red)]",
  TIMEOUT: "text-[var(--color-accent-amber)]",
  DECISION: "text-[var(--color-accent-blue)]",
  KILLED: "text-[var(--color-accent-red)]",
};

function formatEvent(data: Record<string, unknown>, id: number): AuditLine {
  const agent = (data.agent_id as string) ?? "unknown";
  const action = (data.action_type as string) ?? "EVENT";
  const status = (data.status as string) ?? "";
  const dur = data.duration_ms != null ? `${data.duration_ms}ms` : "";
  const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
  return {
    id,
    text: `[${ts}] [${agent}] ${action} ${status} ${dur}`,
    colorClass: STATUS_COLORS[status] ?? "text-[var(--color-text-secondary)]",
  };
}

export function useAuditStream(wsUrl: string) {
  const [lines, setLines] = useState<AuditLine[]>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "audit_event" && msg.data) {
          const line = formatEvent(msg.data, ++counterRef.current);
          setLines((prev) => [...prev, line]);
        }
      } catch {
        /* ignore malformed */
      }
    };

    return () => {
      ws.close();
    };
  }, [wsUrl]);

  const clear = useCallback(() => {
    setLines([]);
  }, []);

  return { lines, clear };
}
