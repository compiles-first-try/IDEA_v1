/**
 * useAuditStream hook tests.
 * - Connects to WebSocket and accumulates audit lines
 * - Provides clear() to reset lines
 * - Handles connection errors gracefully
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuditStream } from "@/hooks/useAuditStream.ts";

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onmessage: ((ev: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 0;
  url: string;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Simulate open on next tick
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.();
    }, 0);
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAuditStream", () => {
  it("connects to the provided WebSocket URL", () => {
    renderHook(() => useAuditStream("ws://localhost:3000/audit-stream"));
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe("ws://localhost:3000/audit-stream");
  });

  it("accumulates audit events as lines", () => {
    const { result } = renderHook(() => useAuditStream("ws://test"));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateMessage({
        type: "audit_event",
        data: { agent_id: "agent-1", action_type: "LLM_CALL", status: "SUCCESS", duration_ms: 100 },
      });
    });

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].text).toContain("agent-1");
    expect(result.current.lines[0].text).toContain("LLM_CALL");
  });

  it("ignores non-audit_event messages", () => {
    const { result } = renderHook(() => useAuditStream("ws://test"));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateMessage({ type: "heartbeat" });
    });

    expect(result.current.lines).toHaveLength(0);
  });

  it("clear() resets lines to empty", () => {
    const { result } = renderHook(() => useAuditStream("ws://test"));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateMessage({
        type: "audit_event",
        data: { agent_id: "a", action_type: "X", status: "SUCCESS" },
      });
    });

    expect(result.current.lines).toHaveLength(1);

    act(() => {
      result.current.clear();
    });

    expect(result.current.lines).toHaveLength(0);
  });

  it("closes WebSocket on unmount", () => {
    const { unmount } = renderHook(() => useAuditStream("ws://test"));
    const ws = MockWebSocket.instances[0];
    unmount();
    expect(ws.close).toHaveBeenCalled();
  });
});
