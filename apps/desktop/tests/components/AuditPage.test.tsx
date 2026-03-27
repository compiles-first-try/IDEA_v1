/**
 * AuditPage — wires Live Stream + History sub-tabs.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AuditPage } from "@/components/audit/AuditPage.tsx";

vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    getAudit: vi.fn().mockResolvedValue({ data: { events: [], total: 0, count: 0 } }),
  },
}));

class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  close = vi.fn();
  constructor(_url: string) { setTimeout(() => this.onopen?.(), 0); }
  send() {}
}
vi.stubGlobal("WebSocket", MockWebSocket);

function renderWithQuery(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("AuditPage (Phase 4)", () => {
  it("renders two sub-tabs: Live Stream and History", () => {
    renderWithQuery(<AuditPage />);
    expect(screen.getByRole("button", { name: /live stream/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /history/i })).toBeInTheDocument();
  });

  it("shows live stream by default", () => {
    renderWithQuery(<AuditPage />);
    expect(screen.getByTestId("audit-terminal")).toBeInTheDocument();
  });

  it("switches to history tab", () => {
    renderWithQuery(<AuditPage />);
    fireEvent.click(screen.getByRole("button", { name: /history/i }));
    expect(screen.getByText("Timestamp")).toBeInTheDocument();
  });
});
