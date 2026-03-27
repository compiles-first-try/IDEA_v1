/**
 * useFeedback hook tests.
 * - useArtifacts fetches /governance/artifacts
 * - useSubmitFeedback calls /governance/feedback/submit
 * - useConfirmFeedback calls /governance/feedback/confirm
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useArtifacts, useSubmitFeedback, useConfirmFeedback } from "@/hooks/useFeedback.ts";

const mockGetArtifacts = vi.fn();
const mockSubmitFeedback = vi.fn();
const mockConfirmFeedback = vi.fn();

vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    getArtifacts: (...args: unknown[]) => mockGetArtifacts(...args),
    submitFeedback: (...args: unknown[]) => mockSubmitFeedback(...args),
    confirmFeedback: (...args: unknown[]) => mockConfirmFeedback(...args),
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

const MOCK_ARTIFACTS = {
  data: {
    artifacts: [
      { id: "art1", type: "CODE", name: "calculator.ts", createdAt: "2026-03-27", qualityScore: 0.92, userRating: null, validationStatus: null },
    ],
    summary: { total: 1, accepted: 0, acceptedWithNote: 0, pendingClarification: 0, overridden: 0 },
  },
};

describe("useArtifacts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns artifacts and summary on success", async () => {
    mockGetArtifacts.mockResolvedValue(MOCK_ARTIFACTS);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useArtifacts(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.artifacts).toHaveLength(1);
    expect(result.current.summary.total).toBe(1);
  });

  it("returns empty on error", async () => {
    mockGetArtifacts.mockRejectedValue(new Error("Failed"));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useArtifacts(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.artifacts).toEqual([]);
  });
});

describe("useSubmitFeedback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls submitFeedback with correct data", async () => {
    mockSubmitFeedback.mockResolvedValue({ data: { accepted: true } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSubmitFeedback(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        artifactId: "art1",
        rating: "up",
        tag: "CORRECT",
        note: "Good output",
      });
    });

    expect(mockSubmitFeedback).toHaveBeenCalledWith({
      artifactId: "art1",
      rating: "up",
      tag: "CORRECT",
      note: "Good output",
    });
  });

  it("invalidates governance-artifacts on success", async () => {
    mockSubmitFeedback.mockResolvedValue({ data: { accepted: true } });
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useSubmitFeedback(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ artifactId: "art1", rating: "down", tag: "INCORRECT" });
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });
});

describe("useConfirmFeedback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls confirmFeedback with correct data", async () => {
    mockConfirmFeedback.mockResolvedValue({ data: { confirmed: true } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useConfirmFeedback(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ artifactId: "art1", action: "confirm" });
    });

    expect(mockConfirmFeedback).toHaveBeenCalledWith({ artifactId: "art1", action: "confirm" });
  });
});
