/**
 * BuildPage — full-width spec input, pipeline + artifacts shown after submit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BuildPage } from "@/components/build/BuildPage.tsx";
import { useSessionStore } from "@/store/session.ts";

vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    submitBuild: vi.fn().mockResolvedValue({ data: { buildId: "b1", status: "queued", message: "ok" } }),
  },
}));

class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  close = vi.fn();
  constructor(_url: string) { setTimeout(() => this.onopen?.(), 0); }
}
vi.stubGlobal("WebSocket", MockWebSocket);

function renderWithQuery(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("BuildPage", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it("renders spec input as the primary interface", () => {
    renderWithQuery(<BuildPage />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /build/i })).toBeInTheDocument();
  });

  it("hides pipeline when no build activity", () => {
    const { container } = renderWithQuery(<BuildPage />);
    expect(container.querySelector("[data-testid='build-right']")).not.toBeInTheDocument();
  });

  it("shows pipeline when build is active", () => {
    useSessionStore.setState({
      busy: true,
      stages: useSessionStore.getState().stages.map((s, i) =>
        i === 0 ? { ...s, status: "running" as const } : s
      ),
    });
    const { container } = renderWithQuery(<BuildPage />);
    expect(container.querySelector("[data-testid='build-right']")).toBeInTheDocument();
    expect(screen.getByText("Spec Interpreter")).toBeInTheDocument();
  });
});
