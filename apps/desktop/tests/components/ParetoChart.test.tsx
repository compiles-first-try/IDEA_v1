/**
 * ParetoChart — scatter plot of cost vs quality per task, colored by tier.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ParetoChart } from "@/components/improvement/ParetoChart.tsx";

const MOCK_DATA = [
  { eventId: "e1", taskTier: 1, costUsd: 0, qualityScore: 0.95, cacheHit: false, agentId: "spec-interp" },
  { eventId: "e2", taskTier: 2, costUsd: 0.004, qualityScore: 0.88, cacheHit: false, agentId: "code-gen" },
  { eventId: "e3", taskTier: 2, costUsd: 0.001, qualityScore: 0.92, cacheHit: true, agentId: "code-gen" },
  { eventId: "e4", taskTier: 3, costUsd: 0.015, qualityScore: 0.97, cacheHit: false, agentId: "complex-gen" },
];

describe("ParetoChart", () => {
  it("renders the chart container", () => {
    render(<ParetoChart data={MOCK_DATA} />);
    expect(screen.getByTestId("pareto-chart")).toBeInTheDocument();
  });

  it("displays tier legend", () => {
    render(<ParetoChart data={MOCK_DATA} />);
    expect(screen.getByText("Tier 1")).toBeInTheDocument();
    expect(screen.getByText("Tier 2")).toBeInTheDocument();
    expect(screen.getByText("Tier 3")).toBeInTheDocument();
  });

  it("shows data point count", () => {
    render(<ParetoChart data={MOCK_DATA} />);
    expect(screen.getByText(/4 data points/i)).toBeInTheDocument();
  });

  it("shows cache hit indicator", () => {
    render(<ParetoChart data={MOCK_DATA} />);
    expect(screen.getByText(/1 cached/i)).toBeInTheDocument();
  });

  it("handles empty data gracefully", () => {
    render(<ParetoChart data={[]} />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });
});
