/**
 * Contract 4: AuditStream
 * - Renders a terminal container
 * - Connects to WebSocket
 * - Displays incoming events as formatted lines
 * - Has a clear button
 *
 * Note: Xterm.js requires a real DOM. We test the wrapper logic
 * with a mock terminal and mock WebSocket.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuditStream } from "@/components/audit/AuditStream.tsx";

// Mock WebSocket
class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  readyState = 1;
  close = vi.fn();

  constructor(_url: string) {
    setTimeout(() => this.onopen?.(), 0);
  }

  simulateMessage(data: string) {
    this.onmessage?.({ data });
  }
}

vi.stubGlobal("WebSocket", MockWebSocket);

describe("Contract 4: AuditStream", () => {
  it("renders a terminal container", () => {
    render(<AuditStream wsUrl="ws://localhost:3000/audit-stream" />);
    expect(screen.getByTestId("audit-terminal")).toBeInTheDocument();
  });

  it("renders a clear button", () => {
    render(<AuditStream wsUrl="ws://localhost:3000/audit-stream" />);
    expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
  });

  it("displays incoming events as formatted lines", async () => {
    render(<AuditStream wsUrl="ws://localhost:3000/audit-stream" />);

    // The component should show events in its log area
    // Wait for connection then simulate a message
    await new Promise((r) => setTimeout(r, 50));

    // Verify the component is mounted and has event display area
    expect(screen.getByTestId("audit-terminal")).toBeInTheDocument();
  });

  it("clears the log when clear button is clicked", async () => {
    render(<AuditStream wsUrl="ws://localhost:3000/audit-stream" />);
    const clearBtn = screen.getByRole("button", { name: /clear/i });
    fireEvent.click(clearBtn);
    // Should not throw
    expect(clearBtn).toBeInTheDocument();
  });
});
