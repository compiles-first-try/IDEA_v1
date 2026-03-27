/**
 * useAgents hook tests.
 * - Fetches /governance/agents
 * - Returns agent list with stats
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAgents } from "@/hooks/useAgents.ts";

const mockGetAgents = vi.fn();

vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    getAgents: (...args: unknown[]) => mockGetAgents(...args),
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

const MOCK_AGENTS = {
  data: {
    agents: [
      { id: "a1", name: "spec-interpreter", role: "PRODUCER", status: "ACTIVE", capabilities: ["interpret-spec"], successRate: 0.95, totalRuns: 120 },
      { id: "a2", name: "code-generator", role: "PRODUCER", status: "ACTIVE", capabilities: ["generate-code"], successRate: 0.88, totalRuns: 80 },
    ],
  },
};

describe("useAgents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns agents on success", async () => {
    mockGetAgents.mockResolvedValue(MOCK_AGENTS);
    const { result } = renderHook(() => useAgents(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.agents).toHaveLength(2);
    expect(result.current.agents[0].name).toBe("spec-interpreter");
  });

  it("returns empty array on error", async () => {
    mockGetAgents.mockRejectedValue(new Error("Failed"));
    const { result } = renderHook(() => useAgents(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.agents).toEqual([]);
  });

  it("uses governance-agents query key", async () => {
    mockGetAgents.mockResolvedValue(MOCK_AGENTS);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    renderHook(() => useAgents(), { wrapper });
    await waitFor(() => expect(qc.getQueryData(["governance-agents"])).toBeDefined());
  });
});
