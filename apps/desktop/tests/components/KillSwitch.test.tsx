/**
 * Contract 1: KillSwitch
 * - Renders a button
 * - Clicking shows confirmation dialog
 * - Confirming calls POST /governance/stop
 * - Cancelling does not call the API
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { KillSwitch } from "@/components/governance/KillSwitch.tsx";

// Mock the governance API
vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    stop: vi.fn().mockResolvedValue({ data: { killed: true } }),
  },
}));

import { governanceApi } from "@/api/governance.ts";

function renderWithQuery(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Contract 1: KillSwitch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a stop button", () => {
    renderWithQuery(<KillSwitch />);
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
  });

  it("shows confirmation dialog on click", async () => {
    renderWithQuery(<KillSwitch />);
    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(
      await screen.findByText(/stop all agent activity/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /stop everything/i })
    ).toBeInTheDocument();
  });

  it("calls POST /governance/stop on confirm", async () => {
    renderWithQuery(<KillSwitch />);
    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /stop everything/i })
    );
    await waitFor(() => {
      expect(governanceApi.stop).toHaveBeenCalledTimes(1);
    });
  });

  it("does not call API on cancel", async () => {
    renderWithQuery(<KillSwitch />);
    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    fireEvent.click(await screen.findByRole("button", { name: /cancel/i }));
    expect(governanceApi.stop).not.toHaveBeenCalled();
  });
});
