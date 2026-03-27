/**
 * DriftChart — agent stability index trends over time.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DriftChart } from "@/components/improvement/DriftChart.tsx";

const MOCK_AGENTS = [
  { agentId: "code-gen", history: [0.95, 0.93, 0.91, 0.90, 0.88], trend: "DECLINING" as const },
  { agentId: "spec-interp", history: [0.80, 0.82, 0.85, 0.87, 0.90], trend: "IMPROVING" as const },
  { agentId: "test-gen", history: [0.92, 0.91, 0.92, 0.91, 0.92], trend: "STABLE" as const },
];

describe("DriftChart", () => {
  it("renders chart container", () => {
    render(<DriftChart agents={MOCK_AGENTS} />);
    expect(screen.getByTestId("drift-chart")).toBeInTheDocument();
  });

  it("shows all agent names", () => {
    render(<DriftChart agents={MOCK_AGENTS} />);
    expect(screen.getByText("code-gen")).toBeInTheDocument();
    expect(screen.getByText("spec-interp")).toBeInTheDocument();
    expect(screen.getByText("test-gen")).toBeInTheDocument();
  });

  it("shows trend indicators", () => {
    render(<DriftChart agents={MOCK_AGENTS} />);
    expect(screen.getByText("DECLINING")).toBeInTheDocument();
    expect(screen.getByText("IMPROVING")).toBeInTheDocument();
    expect(screen.getByText("STABLE")).toBeInTheDocument();
  });

  it("flags declining agents with warning color", () => {
    const { container } = render(<DriftChart agents={MOCK_AGENTS} />);
    const declining = container.querySelector("[data-trend='DECLINING']");
    expect(declining).toBeInTheDocument();
    expect(declining?.className).toContain("red");
  });

  it("handles empty agent list", () => {
    render(<DriftChart agents={[]} />);
    expect(screen.getByText(/no drift data/i)).toBeInTheDocument();
  });
});
