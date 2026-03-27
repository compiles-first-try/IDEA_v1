/**
 * useModels hook tests.
 * - Fetches /governance/models
 * - Returns Ollama models, Anthropic status, router tiers
 * - Handles loading/error states
 * - usePullModel calls pullModel endpoint
 * - useTestAnthropic calls test-anthropic endpoint
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useModels, usePullModel, useTestAnthropic } from "@/hooks/useModels.ts";

const mockGetModels = vi.fn();
const mockPullModel = vi.fn();
const mockTestAnthropic = vi.fn();

vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    getModels: (...args: unknown[]) => mockGetModels(...args),
    pullModel: (...args: unknown[]) => mockPullModel(...args),
    testAnthropic: (...args: unknown[]) => mockTestAnthropic(...args),
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

const MOCK_MODELS = {
  data: {
    ollama: [
      { name: "qwen2.5-coder:14b", size: "8.7 GB", modifiedAt: "2026-03-20T10:00:00Z" },
      { name: "llama3.3:8b", size: "4.7 GB", modifiedAt: "2026-03-18T08:00:00Z" },
    ],
    ollamaReachable: true,
    anthropicKeySet: true,
    anthropicModels: ["claude-sonnet-4-6-20250514", "claude-haiku-4-5-20251001"],
    routerTiers: [
      { tier: "TRIVIAL", model: "llama3.3:8b", costPerCall: "$0.00", callsToday: 12 },
      { tier: "STANDARD", model: "qwen2.5-coder:14b", costPerCall: "$0.00", callsToday: 45 },
      { tier: "COMPLEX", model: "claude-haiku-4-5-20251001", costPerCall: "~$0.001", callsToday: 8 },
      { tier: "CRITICAL", model: "claude-sonnet-4-6-20250514", costPerCall: "~$0.015", callsToday: 2 },
    ],
  },
};

describe("useModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns model data on success", async () => {
    mockGetModels.mockResolvedValue(MOCK_MODELS);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useModels(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.ollama).toHaveLength(2);
    expect(result.current.data?.anthropicKeySet).toBe(true);
    expect(result.current.data?.routerTiers).toHaveLength(4);
  });

  it("handles loading state", () => {
    mockGetModels.mockReturnValue(new Promise(() => {}));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useModels(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it("handles error state", async () => {
    mockGetModels.mockRejectedValue(new Error("Failed"));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useModels(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("uses governance-models query key", async () => {
    mockGetModels.mockResolvedValue(MOCK_MODELS);
    const { wrapper, qc } = createWrapper();
    renderHook(() => useModels(), { wrapper });
    await waitFor(() => expect(qc.getQueryData(["governance-models"])).toBeDefined());
  });
});

describe("usePullModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls pullModel with model name", async () => {
    mockPullModel.mockResolvedValue({ data: {} });
    mockGetModels.mockResolvedValue(MOCK_MODELS);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePullModel(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("nomic-embed-text:latest");
    });

    expect(mockPullModel).toHaveBeenCalledWith("nomic-embed-text:latest");
  });

  it("invalidates governance-models on success", async () => {
    mockPullModel.mockResolvedValue({ data: {} });
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => usePullModel(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("test-model");
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });
});

describe("useTestAnthropic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls testAnthropic and returns result", async () => {
    mockTestAnthropic.mockResolvedValue({
      data: { success: true, message: "Connection successful" },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTestAnthropic(), { wrapper });

    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync();
    });

    expect(mockTestAnthropic).toHaveBeenCalledOnce();
    expect(response).toEqual({ data: { success: true, message: "Connection successful" } });
  });
});
