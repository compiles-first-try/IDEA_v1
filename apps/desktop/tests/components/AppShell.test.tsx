/**
 * App Shell integration tests.
 * - Renders TopBar, Sidebar, and MainPanel
 * - Route switching shows correct placeholder content
 * - Layout persists sidebar state
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "@/App.tsx";
import { useLayoutStore } from "@/store/layout.ts";

vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    getStatus: vi.fn().mockResolvedValue({
      data: {
        killSwitchActive: false,
        dailySpend: 0,
        autonomyLevel: "supervised",
        timestamp: new Date().toISOString(),
        schema_version: "2",
      },
    }),
    stop: vi.fn().mockResolvedValue({ data: { killed: true } }),
  },
}));

function renderApp() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>
  );
}

describe("App Shell", () => {
  beforeEach(() => {
    useLayoutStore.setState({ sidebarCollapsed: false, activeRoute: "build" });
  });

  it("renders top bar with RSF and kill switch", () => {
    renderApp();
    expect(screen.getByText("RSF")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
  });

  it("renders sidebar with navigation", () => {
    renderApp();
    expect(screen.getAllByText("Build").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Config").length).toBeGreaterThanOrEqual(1);
  });

  it("switching route shows placeholder for that section", () => {
    renderApp();
    fireEvent.click(screen.getByText("Audit"));
    expect(screen.getByTestId("page-audit")).toBeInTheDocument();
  });

  it("switching to Config shows config placeholder", () => {
    renderApp();
    fireEvent.click(screen.getByText("Config"));
    expect(screen.getByTestId("page-config")).toBeInTheDocument();
  });
});
