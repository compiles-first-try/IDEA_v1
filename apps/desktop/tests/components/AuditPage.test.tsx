/**
 * AuditPage — wires Live Stream + History sub-tabs.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuditPage } from "@/components/audit/AuditPage.tsx";

class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  close = vi.fn();
  constructor(_url: string) { setTimeout(() => this.onopen?.(), 0); }
  send() {}
}
vi.stubGlobal("WebSocket", MockWebSocket);

describe("AuditPage (Phase 4)", () => {
  it("renders two sub-tabs: Live Stream and History", () => {
    render(<AuditPage />);
    expect(screen.getByRole("button", { name: /live stream/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /history/i })).toBeInTheDocument();
  });

  it("shows live stream by default", () => {
    render(<AuditPage />);
    expect(screen.getByTestId("audit-terminal")).toBeInTheDocument();
  });

  it("switches to history tab", () => {
    render(<AuditPage />);
    fireEvent.click(screen.getByRole("button", { name: /history/i }));
    expect(screen.getByText("Timestamp")).toBeInTheDocument();
  });
});
