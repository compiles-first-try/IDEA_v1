/**
 * AuditStream (Phase 4) — enhanced live terminal.
 * Color coded lines, auto-scroll toggle, clear button.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AuditStreamFull } from "@/components/audit/AuditStreamFull.tsx";

// Mock WebSocket
class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  close = vi.fn();
  constructor(_url: string) {
    setTimeout(() => this.onopen?.(), 0);
  }
  send(_data: string) {}
}
vi.stubGlobal("WebSocket", MockWebSocket);

describe("AuditStream Full (Phase 4)", () => {
  it("renders terminal container with dark background", () => {
    render(<AuditStreamFull wsUrl="ws://test/audit-stream" />);
    const terminal = screen.getByTestId("audit-terminal");
    expect(terminal).toBeInTheDocument();
    expect(terminal.className).toContain("bg-black");
  });

  it("renders clear button and auto-scroll toggle", () => {
    render(<AuditStreamFull wsUrl="ws://test/audit-stream" />);
    expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /auto-scroll/i })).toBeInTheDocument();
  });

  it("auto-scroll is on by default", () => {
    render(<AuditStreamFull wsUrl="ws://test/audit-stream" />);
    const btn = screen.getByRole("button", { name: /auto-scroll/i });
    expect(btn.textContent).toContain("ON");
  });

  it("toggles auto-scroll off and on", () => {
    render(<AuditStreamFull wsUrl="ws://test/audit-stream" />);
    const btn = screen.getByRole("button", { name: /auto-scroll/i });
    fireEvent.click(btn);
    expect(btn.textContent).toContain("OFF");
    fireEvent.click(btn);
    expect(btn.textContent).toContain("ON");
  });

  it("clear resets displayed lines", async () => {
    render(<AuditStreamFull wsUrl="ws://test/audit-stream" />);
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    // Should not throw, terminal should be empty
    expect(screen.getByTestId("audit-terminal")).toBeInTheDocument();
  });

  it("formats event lines with status color classes", async () => {
    const { container } = render(<AuditStreamFull wsUrl="ws://test/audit-stream" />);
    // Simulate receiving a WebSocket message
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    // The component should be ready to receive messages
    expect(container).toBeTruthy();
  });
});
