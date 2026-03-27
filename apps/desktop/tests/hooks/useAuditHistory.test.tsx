/**
 * useAuditHistory hook tests.
 * - Fetches /governance/audit with filters and pagination
 * - Re-fetches when filters or page change
 * - Returns events, total, isLoading, isError
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAuditHistory } from "@/hooks/useAuditHistory.ts";

const mockGetAudit = vi.fn();

vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    getAudit: (...args: unknown[]) => mockGetAudit(...args),
  },
}));

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const MOCK_RESPONSE = {
  data: {
    events: [
      { id: 1, event_id: "e1", timestamp: "2026-03-27T10:00:00Z", agent_id: "agent-1", agent_type: "CODE_GENERATOR", action_type: "LLM_CALL", phase: "L3", status: "SUCCESS", model_used: "qwen2.5-coder:14b", tokens_in: 100, tokens_out: 200, duration_ms: 500 },
    ],
    total: 42,
    count: 1,
  },
};

describe("useAuditHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches audit events with default params", async () => {
    mockGetAudit.mockResolvedValue(MOCK_RESPONSE);

    const { result } = renderHook(() => useAuditHistory(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.events).toHaveLength(1);
    expect(result.current.total).toBe(42);
    expect(mockGetAudit).toHaveBeenCalledWith({ limit: 50, offset: 0 });
  });

  it("passes filters to API", async () => {
    mockGetAudit.mockResolvedValue(MOCK_RESPONSE);

    const { result } = renderHook(
      () => useAuditHistory({ agentId: "agent-1", status: "FAILURE" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetAudit).toHaveBeenCalledWith({
      limit: 50,
      offset: 0,
      agentId: "agent-1",
      status: "FAILURE",
    });
  });

  it("supports pagination via page param", async () => {
    mockGetAudit.mockResolvedValue(MOCK_RESPONSE);

    const { result } = renderHook(
      () => useAuditHistory({ page: 3 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetAudit).toHaveBeenCalledWith({ limit: 50, offset: 100 });
  });

  it("returns empty events on error", async () => {
    mockGetAudit.mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useAuditHistory(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.events).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it("includes query key with filters for cache separation", async () => {
    mockGetAudit.mockResolvedValue(MOCK_RESPONSE);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    renderHook(() => useAuditHistory({ agentId: "x" }), { wrapper });
    await waitFor(() =>
      expect(qc.getQueryData(["governance-audit", { agentId: "x", page: 1 }])).toBeDefined()
    );
  });
});
