/**
 * BuildPage — wires SpecInput (40%) + PipelineView + ArtifactView (60%).
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

describe("BuildPage (Phase 3)", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it("renders spec input panel and pipeline panel", () => {
    renderWithQuery(<BuildPage />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByText("Spec Interpreter")).toBeInTheDocument();
  });

  it("shows no artifacts message initially", () => {
    renderWithQuery(<BuildPage />);
    expect(screen.getByText(/no artifacts/i)).toBeInTheDocument();
  });

  it("renders 40/60 split layout", () => {
    const { container } = renderWithQuery(<BuildPage />);
    const panels = container.querySelectorAll("[data-testid='build-left'], [data-testid='build-right']");
    expect(panels).toHaveLength(2);
  });
});
