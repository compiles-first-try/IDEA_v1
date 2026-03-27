/**
 * useImproveMetrics + useTriggerImprove hook tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useImproveMetrics, useTriggerImprove } from "@/hooks/useImprove.ts";

const mockGetMetrics = vi.fn();
const mockTriggerImprove = vi.fn();

vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    getImproveMetrics: (...args: unknown[]) => mockGetMetrics(...args),
    triggerImprove: (...args: unknown[]) => mockTriggerImprove(...args),
  },
}));

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
    qc,
  };
}

const MOCK_METRICS = {
  data: {
    overallScores: [0.82, 0.85, 0.87, 0.9],
    componentScores: { CODE: 0.88, TEST: 0.92, SPEC: 0.85 },
    regressionBudget: { used: 1, total: 5 },
    lastCycle: { timestamp: "2026-03-27T10:00:00Z", changes: "Optimized spec interpreter prompt", delta: 0.03 },
  },
};

describe("useImproveMetrics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns metrics on success", async () => {
    mockGetMetrics.mockResolvedValue(MOCK_METRICS);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useImproveMetrics(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.metrics.overallScores).toHaveLength(4);
    expect(result.current.metrics.componentScores.CODE).toBe(0.88);
    expect(result.current.metrics.regressionBudget.used).toBe(1);
    expect(result.current.metrics.lastCycle?.delta).toBe(0.03);
  });

  it("returns defaults on error", async () => {
    mockGetMetrics.mockRejectedValue(new Error("Failed"));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useImproveMetrics(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.metrics.overallScores).toEqual([]);
    expect(result.current.metrics.regressionBudget.total).toBe(5);
  });

  it("uses governance-improve-metrics query key", async () => {
    mockGetMetrics.mockResolvedValue(MOCK_METRICS);
    const { wrapper, qc } = createWrapper();
    renderHook(() => useImproveMetrics(), { wrapper });
    await waitFor(() => expect(qc.getQueryData(["governance-improve-metrics"])).toBeDefined());
  });
});

describe("useTriggerImprove", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls triggerImprove on trigger", async () => {
    mockTriggerImprove.mockResolvedValue({ data: { status: "triggered" } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTriggerImprove(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockTriggerImprove).toHaveBeenCalledOnce();
  });

  it("invalidates metrics on success", async () => {
    mockTriggerImprove.mockResolvedValue({ data: { status: "triggered" } });
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useTriggerImprove(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });
});
