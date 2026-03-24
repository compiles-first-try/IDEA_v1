/**
 * QualityArchive — improvement history with chart + table.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QualityArchive } from "@/components/improvement/QualityArchive.tsx";

const MOCK_HISTORY = [
  { generation: 1, score: 0.65, changes: "Initial configuration", parentId: null, timestamp: "2026-03-20T10:00:00Z" },
  { generation: 2, score: 0.72, changes: "Improved code gen prompt", parentId: "gen1", timestamp: "2026-03-21T10:00:00Z" },
  { generation: 3, score: 0.78, changes: "Added repair retries", parentId: "gen2", timestamp: "2026-03-22T10:00:00Z" },
  { generation: 4, score: 0.81, changes: "Optimized test generation", parentId: "gen3", timestamp: "2026-03-23T10:00:00Z" },
];

describe("QualityArchive (Phase 4)", () => {
  it("renders quality score chart area", () => {
    render(<QualityArchive history={MOCK_HISTORY} />);
    expect(screen.getByTestId("quality-chart")).toBeInTheDocument();
  });

  it("renders history table with all generations", () => {
    render(<QualityArchive history={MOCK_HISTORY} />);
    expect(screen.getByText("Initial configuration")).toBeInTheDocument();
    expect(screen.getByText("Improved code gen prompt")).toBeInTheDocument();
    expect(screen.getByText("Optimized test generation")).toBeInTheDocument();
  });

  it("shows generation numbers", () => {
    render(<QualityArchive history={MOCK_HISTORY} />);
    expect(screen.getByText("Gen 1")).toBeInTheDocument();
    expect(screen.getByText("Gen 4")).toBeInTheDocument();
  });

  it("shows benchmark scores", () => {
    render(<QualityArchive history={MOCK_HISTORY} />);
    expect(screen.getAllByText("0.65").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("0.81").length).toBeGreaterThanOrEqual(1);
  });

  it("clicking a row shows detail", () => {
    render(<QualityArchive history={MOCK_HISTORY} />);
    fireEvent.click(screen.getByText("Improved code gen prompt"));
    expect(screen.getByTestId("archive-detail")).toBeInTheDocument();
  });
});
