/**
 * useHealth hook tests.
 * - Fetches /health
 * - Returns { status, timestamp }
 * - Exposes isHealthy convenience boolean
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useHealth } from "@/hooks/useHealth.ts";

const mockGetHealth = vi.fn();

vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    getHealth: (...args: unknown[]) => mockGetHealth(...args),
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

describe("useHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns health data on success", async () => {
    mockGetHealth.mockResolvedValue({
      data: { status: "ok", timestamp: "2026-03-27T10:00:00Z" },
    });

    const { result } = renderHook(() => useHealth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      status: "ok",
      timestamp: "2026-03-27T10:00:00Z",
    });
  });

  it("exposes isHealthy convenience boolean", async () => {
    mockGetHealth.mockResolvedValue({
      data: { status: "ok", timestamp: "" },
    });

    const { result } = renderHook(() => useHealth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isHealthy).toBe(true);
  });

  it("isHealthy is false when status is not ok", async () => {
    mockGetHealth.mockResolvedValue({
      data: { status: "degraded", timestamp: "" },
    });

    const { result } = renderHook(() => useHealth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isHealthy).toBe(false);
  });

  it("isHealthy is false during loading", () => {
    mockGetHealth.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useHealth(), {
      wrapper: createWrapper(),
    });
    expect(result.current.isHealthy).toBe(false);
  });

  it("uses health query key", async () => {
    mockGetHealth.mockResolvedValue({
      data: { status: "ok", timestamp: "" },
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    renderHook(() => useHealth(), { wrapper });
    await waitFor(() => expect(qc.getQueryData(["health"])).toBeDefined());
  });
});
