/**
 * useDocs, useIngestDoc, useDeleteDoc, useSearchDocs hook tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useDocs, useIngestDoc, useDeleteDoc, useSearchDocs } from "@/hooks/useDocs.ts";

const mockGetDocs = vi.fn();
const mockIngestDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockSearchDocs = vi.fn();

vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    ingestDoc: (...args: unknown[]) => mockIngestDoc(...args),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
    searchDocs: (...args: unknown[]) => mockSearchDocs(...args),
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

const MOCK_DOCS = {
  data: {
    docs: [
      { id: "d1", name: "README.md", type: "markdown", date_ingested: "2026-03-27T10:00:00Z", chunk_count: 5, last_retrieved: null },
      { id: "d2", name: "api-spec.json", type: "json", date_ingested: "2026-03-26T08:00:00Z", chunk_count: 12, last_retrieved: "2026-03-27T09:00:00Z" },
    ],
  },
};

describe("useDocs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns docs on success", async () => {
    mockGetDocs.mockResolvedValue(MOCK_DOCS);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDocs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.docs).toHaveLength(2);
  });

  it("returns empty array on error", async () => {
    mockGetDocs.mockRejectedValue(new Error("Failed"));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDocs(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.docs).toEqual([]);
  });

  it("uses governance-docs query key", async () => {
    mockGetDocs.mockResolvedValue(MOCK_DOCS);
    const { wrapper, qc } = createWrapper();
    renderHook(() => useDocs(), { wrapper });
    await waitFor(() => expect(qc.getQueryData(["governance-docs"])).toBeDefined());
  });
});

describe("useIngestDoc", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls ingestDoc with URL and tags", async () => {
    mockIngestDoc.mockResolvedValue({ data: { docId: "d3", name: "test.md", chunks: 3 } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIngestDoc(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ url: "https://example.com/test.md", tags: "docs,api" });
    });

    expect(mockIngestDoc).toHaveBeenCalledWith({ url: "https://example.com/test.md", tags: "docs,api" });
  });

  it("invalidates governance-docs on success", async () => {
    mockIngestDoc.mockResolvedValue({ data: { docId: "d3", name: "test.md", chunks: 3 } });
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useIngestDoc(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ url: "https://example.com/test.md" });
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });
});

describe("useDeleteDoc", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls deleteDoc with ID", async () => {
    mockDeleteDoc.mockResolvedValue({ data: { deleted: true, rowsRemoved: 5 } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteDoc(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("d1");
    });

    expect(mockDeleteDoc).toHaveBeenCalledWith("d1");
  });

  it("invalidates governance-docs on success", async () => {
    mockDeleteDoc.mockResolvedValue({ data: { deleted: true } });
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useDeleteDoc(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("d1");
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });
});

describe("useSearchDocs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls searchDocs with query", async () => {
    mockSearchDocs.mockResolvedValue({
      data: { results: [{ content: "Found text", score: 0.95 }] },
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSearchDocs(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("test query");
    });

    expect(mockSearchDocs).toHaveBeenCalledWith("test query", 10);
  });

  it("returns search results", async () => {
    mockSearchDocs.mockResolvedValue({
      data: { results: [{ content: "Result A", score: 0.9 }, { content: "Result B", score: 0.8 }] },
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSearchDocs(), { wrapper });

    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync("query");
    });

    expect(response).toEqual({
      data: { results: [{ content: "Result A", score: 0.9 }, { content: "Result B", score: 0.8 }] },
    });
  });
});
