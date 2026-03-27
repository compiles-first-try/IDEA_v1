/**
 * useConfig + useSaveConfig hook tests.
 * - useConfig fetches GET /governance/config
 * - useSaveConfig sends PATCH /governance/config and invalidates cache
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useConfig, useSaveConfig } from "@/hooks/useConfig.ts";

const mockGetConfig = vi.fn();
const mockPatchConfig = vi.fn();

vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    getConfig: (...args: unknown[]) => mockGetConfig(...args),
    patchConfig: (...args: unknown[]) => mockPatchConfig(...args),
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

describe("useConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns config data on success", async () => {
    mockGetConfig.mockResolvedValue({
      data: { maxDailySpendUsd: 10, autonomyLevel: "supervised", schema_version: "2" },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useConfig(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      maxDailySpendUsd: 10,
      autonomyLevel: "supervised",
      schema_version: "2",
    });
  });

  it("handles error state", async () => {
    mockGetConfig.mockRejectedValue(new Error("Server error"));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useConfig(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("uses governance-config query key", async () => {
    mockGetConfig.mockResolvedValue({
      data: { maxDailySpendUsd: 10, autonomyLevel: "supervised" },
    });

    const { wrapper, qc } = createWrapper();
    renderHook(() => useConfig(), { wrapper });
    await waitFor(() => expect(qc.getQueryData(["governance-config"])).toBeDefined());
  });
});

describe("useSaveConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls patchConfig with provided data", async () => {
    mockGetConfig.mockResolvedValue({
      data: { maxDailySpendUsd: 10, autonomyLevel: "supervised" },
    });
    mockPatchConfig.mockResolvedValue({
      data: { maxDailySpendUsd: 15, autonomyLevel: "supervised", schema_version: "2" },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveConfig(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ maxDailySpendUsd: 15 });
    });

    expect(mockPatchConfig).toHaveBeenCalledWith({ maxDailySpendUsd: 15 });
  });

  it("invalidates governance-config query on success", async () => {
    mockGetConfig.mockResolvedValue({
      data: { maxDailySpendUsd: 10, autonomyLevel: "supervised" },
    });
    mockPatchConfig.mockResolvedValue({
      data: { maxDailySpendUsd: 20, autonomyLevel: "supervised" },
    });

    const { wrapper, qc } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useSaveConfig(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ maxDailySpendUsd: 20 });
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("handles mutation error", async () => {
    mockPatchConfig.mockRejectedValue(new Error("Validation failed"));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveConfig(), { wrapper });

    act(() => {
      result.current.mutate({ maxDailySpendUsd: -1 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
