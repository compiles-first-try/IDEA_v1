/**
 * useFoundryStatus hook tests.
 * - Fetches /governance/status every 5s
 * - Returns killSwitchActive, dailySpend, autonomyLevel
 * - Handles loading and error states
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useFoundryStatus } from "@/hooks/useFoundryStatus.ts";

const mockGetStatus = vi.fn();

vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    getStatus: (...args: unknown[]) => mockGetStatus(...args),
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

describe("useFoundryStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns status data on success", async () => {
    mockGetStatus.mockResolvedValue({
      data: {
        killSwitchActive: false,
        dailySpend: 3.25,
        autonomyLevel: "supervised",
        timestamp: "2026-03-27T10:00:00Z",
        schema_version: "2",
      },
    });

    const { result } = renderHook(() => useFoundryStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      killSwitchActive: false,
      dailySpend: 3.25,
      autonomyLevel: "supervised",
      timestamp: "2026-03-27T10:00:00Z",
      schema_version: "2",
    });
  });

  it("starts in loading state", () => {
    mockGetStatus.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useFoundryStatus(), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("returns error state on failure", async () => {
    mockGetStatus.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useFoundryStatus(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });

  it("uses governance-status query key", async () => {
    mockGetStatus.mockResolvedValue({
      data: { killSwitchActive: false, dailySpend: 0, autonomyLevel: "supervised", timestamp: "" },
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    renderHook(() => useFoundryStatus(), { wrapper });
    await waitFor(() => expect(qc.getQueryData(["governance-status"])).toBeDefined());
  });
});
