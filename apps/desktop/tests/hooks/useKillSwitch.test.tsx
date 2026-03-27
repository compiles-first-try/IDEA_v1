/**
 * useKillSwitch hook tests.
 * - Calls POST /governance/stop
 * - Invalidates governance-status query on success
 * - Returns mutation state (isPending, isSuccess, isError)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useKillSwitch } from "@/hooks/useKillSwitch.ts";

const mockStop = vi.fn();

vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    stop: (...args: unknown[]) => mockStop(...args),
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

describe("useKillSwitch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls governanceApi.stop on activate", async () => {
    mockStop.mockResolvedValue({ data: { killed: true, timestamp: "" } });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useKillSwitch(), { wrapper });

    await act(async () => {
      await result.current.activate();
    });

    expect(mockStop).toHaveBeenCalledOnce();
  });

  it("returns isPending while stopping", async () => {
    let resolve: (v: unknown) => void;
    mockStop.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useKillSwitch(), { wrapper });

    act(() => {
      result.current.activate();
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    await act(async () => {
      resolve!({ data: { killed: true } });
    });
  });

  it("invalidates governance-status query on success", async () => {
    mockStop.mockResolvedValue({ data: { killed: true } });

    const { wrapper, qc } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useKillSwitch(), { wrapper });

    await act(async () => {
      await result.current.activate();
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("handles error state", async () => {
    mockStop.mockRejectedValue(new Error("Connection refused"));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useKillSwitch(), { wrapper });

    act(() => {
      result.current.activate().catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
