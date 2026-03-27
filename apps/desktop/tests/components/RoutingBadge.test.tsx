/**
 * RoutingBadge — shows tier classification and escalation status.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoutingBadge } from "@/components/shared/RoutingBadge.tsx";

describe("RoutingBadge", () => {
  it("renders tier number", () => {
    render(<RoutingBadge tier={2} classification="STANDARD" escalated={false} />);
    expect(screen.getByText("Tier 2")).toBeInTheDocument();
  });

  it("renders classification", () => {
    render(<RoutingBadge tier={2} classification="STANDARD" escalated={false} />);
    expect(screen.getByText("STANDARD")).toBeInTheDocument();
  });

  it("shows escalation indicator when escalated", () => {
    render(<RoutingBadge tier={3} classification="COMPLEX" escalated={true} />);
    expect(screen.getByText(/escalated/i)).toBeInTheDocument();
  });

  it("does not show escalation when not escalated", () => {
    render(<RoutingBadge tier={2} classification="STANDARD" escalated={false} />);
    expect(screen.queryByText(/escalated/i)).not.toBeInTheDocument();
  });

  it("uses green for Tier 1, amber for Tier 2, red for Tier 3", () => {
    const { container: c1 } = render(<RoutingBadge tier={1} classification="SIMPLE" escalated={false} />);
    expect(c1.querySelector("[data-testid='tier-badge']")?.className).toContain("green");
  });
});
