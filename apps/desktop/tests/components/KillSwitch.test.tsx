/**
 * Contract 1: KillSwitch
 * - Renders a button
 * - Clicking shows confirmation dialog
 * - Confirming calls POST /governance/stop
 * - Cancelling does not call the API
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { KillSwitch } from "@/components/governance/KillSwitch.tsx";

// Mock the governance API
vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    stop: vi.fn().mockResolvedValue({ data: { killed: true } }),
  },
}));

import { governanceApi } from "@/api/governance.ts";

describe("Contract 1: KillSwitch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a stop button", () => {
    render(<KillSwitch />);
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
  });

  it("shows confirmation dialog on click", async () => {
    render(<KillSwitch />);
    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(
      await screen.findByText(/stop all agent activity/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /stop everything/i })
    ).toBeInTheDocument();
  });

  it("calls POST /governance/stop on confirm", async () => {
    render(<KillSwitch />);
    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /stop everything/i })
    );
    await waitFor(() => {
      expect(governanceApi.stop).toHaveBeenCalledTimes(1);
    });
  });

  it("does not call API on cancel", async () => {
    render(<KillSwitch />);
    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    fireEvent.click(await screen.findByRole("button", { name: /cancel/i }));
    expect(governanceApi.stop).not.toHaveBeenCalled();
  });
});
