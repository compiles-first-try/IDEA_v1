/**
 * useBuild hook tests.
 * - Submits spec to POST /governance/build
 * - Returns buildId and mutation state
 * - Listens to WebSocket for stage events and updates session store
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useBuild } from "@/hooks/useBuild.ts";
import { useSessionStore } from "@/store/session.ts";

const mockSubmitBuild = vi.fn();

vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    submitBuild: (...args: unknown[]) => mockSubmitBuild(...args),
  },
}));

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onmessage: ((ev: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  close = vi.fn();
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("useBuild", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    useSessionStore.getState().reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls submitBuild with spec and reasoning mode", async () => {
    mockSubmitBuild.mockResolvedValue({
      data: { buildId: "b1", status: "queued", message: "ok" },
    });

    const { result } = renderHook(() => useBuild(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.submit("Build a calculator", "sequential");
    });

    expect(mockSubmitBuild).toHaveBeenCalledWith({
      spec: "Build a calculator",
      reasoningMode: "sequential",
    });
  });

  it("returns buildId on success", async () => {
    mockSubmitBuild.mockResolvedValue({
      data: { buildId: "b42", status: "queued", message: "ok" },
    });

    const { result } = renderHook(() => useBuild(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.submit("test spec", "feynman");
    });

    expect(result.current.buildId).toBe("b42");
  });

  it("sets session store to busy on submit", async () => {
    mockSubmitBuild.mockResolvedValue({
      data: { buildId: "b1", status: "queued", message: "ok" },
    });

    const { result } = renderHook(() => useBuild(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.submit("spec", "sequential");
    });

    expect(useSessionStore.getState().busy).toBe(true);
  });

  it("handles submission error", async () => {
    mockSubmitBuild.mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useBuild(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.submit("spec", "sequential").catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
