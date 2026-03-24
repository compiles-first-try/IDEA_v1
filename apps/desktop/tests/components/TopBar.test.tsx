/**
 * TopBar tests.
 * - Renders RSF wordmark
 * - Shows status indicator
 * - Shows daily spend
 * - Kill switch always visible and right-aligned
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/TopBar.tsx";

vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    getStatus: vi.fn().mockResolvedValue({
      data: {
        killSwitchActive: false,
        dailySpend: 2.5,
        autonomyLevel: "supervised",
        timestamp: new Date().toISOString(),
        schema_version: "2",
      },
    }),
    stop: vi.fn().mockResolvedValue({ data: { killed: true } }),
  },
}));

function renderWithQuery(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("TopBar", () => {
  it("renders RSF wordmark", () => {
    renderWithQuery(<TopBar />);
    expect(screen.getByText("RSF")).toBeInTheDocument();
  });

  it("renders kill switch button", () => {
    renderWithQuery(<TopBar />);
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
  });

  it("shows daily spend after data loads", async () => {
    renderWithQuery(<TopBar />);
    expect(await screen.findByText(/\$2\.50/)).toBeInTheDocument();
  });

  it("shows status indicator", async () => {
    renderWithQuery(<TopBar />);
    expect(await screen.findByText(/running/i)).toBeInTheDocument();
  });
});
