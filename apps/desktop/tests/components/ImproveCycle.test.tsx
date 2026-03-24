/**
 * ImproveCycle — metrics, trigger, progress, results.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImproveCycle } from "@/components/improvement/ImproveCycle.tsx";

const MOCK_METRICS = {
  overallScores: [0.65, 0.72, 0.78, 0.81],
  componentScores: { Foundation: 0.9, Orchestration: 0.85, Manufacturing: 0.78, Quality: 0.82, Provisioning: 0.75 },
  regressionBudget: { used: 2, total: 5 },
  lastCycle: { timestamp: "2026-03-23T10:00:00Z", changes: "Improved code gen prompt", delta: 0.03 },
};

describe("ImproveCycle (Phase 5)", () => {
  it("renders quality score chart area", () => {
    render(<ImproveCycle metrics={MOCK_METRICS} onTrigger={vi.fn()} running={false} />);
    expect(screen.getByTestId("quality-trend-chart")).toBeInTheDocument();
  });

  it("renders per-component scores", () => {
    render(<ImproveCycle metrics={MOCK_METRICS} onTrigger={vi.fn()} running={false} />);
    expect(screen.getByText("Foundation")).toBeInTheDocument();
    expect(screen.getByText("Manufacturing")).toBeInTheDocument();
  });

  it("renders regression budget progress bar", () => {
    render(<ImproveCycle metrics={MOCK_METRICS} onTrigger={vi.fn()} running={false} />);
    expect(screen.getByTestId("regression-budget")).toBeInTheDocument();
    expect(screen.getByText(/2.*of.*5/i)).toBeInTheDocument();
  });

  it("renders trigger button", () => {
    render(<ImproveCycle metrics={MOCK_METRICS} onTrigger={vi.fn()} running={false} />);
    expect(screen.getByRole("button", { name: /run improvement/i })).toBeInTheDocument();
  });

  it("trigger button shows confirmation modal", () => {
    render(<ImproveCycle metrics={MOCK_METRICS} onTrigger={vi.fn()} running={false} />);
    fireEvent.click(screen.getByRole("button", { name: /run improvement/i }));
    expect(screen.getByText(/analyze all recent builds/i)).toBeInTheDocument();
  });

  it("trigger button disabled when running", () => {
    render(<ImproveCycle metrics={MOCK_METRICS} onTrigger={vi.fn()} running={true} />);
    expect(screen.getByRole("button", { name: /running/i })).toBeDisabled();
  });

  it("shows last cycle info", () => {
    render(<ImproveCycle metrics={MOCK_METRICS} onTrigger={vi.fn()} running={false} />);
    expect(screen.getByText(/improved code gen prompt/i)).toBeInTheDocument();
  });
});
