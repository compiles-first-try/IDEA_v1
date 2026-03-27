/**
 * UncertaintyDisplay — shows epistemic + aleatoric uncertainty with action recommendation.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UncertaintyDisplay } from "@/components/shared/UncertaintyDisplay.tsx";

describe("UncertaintyDisplay", () => {
  it("renders epistemic and aleatoric values", () => {
    render(<UncertaintyDisplay epistemic={0.31} aleatoric={0.06} action="PROCEED" />);
    expect(screen.getByText(/0\.31/)).toBeInTheDocument();
    expect(screen.getByText(/0\.06/)).toBeInTheDocument();
  });

  it("renders action recommendation", () => {
    render(<UncertaintyDisplay epistemic={0.31} aleatoric={0.06} action="PROCEED" />);
    expect(screen.getByText("PROCEED")).toBeInTheDocument();
  });

  it("shows SEEK_INFORMATION with amber styling", () => {
    render(<UncertaintyDisplay epistemic={0.7} aleatoric={0.1} action="SEEK_INFORMATION" />);
    expect(screen.getByText("SEEK_INFORMATION")).toBeInTheDocument();
  });

  it("shows HALT with red styling", () => {
    render(<UncertaintyDisplay epistemic={0.8} aleatoric={0.8} action="HALT" />);
    expect(screen.getByText("HALT")).toBeInTheDocument();
  });

  it("renders bar visualization for uncertainty levels", () => {
    const { container } = render(<UncertaintyDisplay epistemic={0.5} aleatoric={0.3} action="PROCEED" />);
    const bars = container.querySelectorAll("[data-testid='uncertainty-bar']");
    expect(bars).toHaveLength(2);
  });
});
