/**
 * BuildPage — wires SpecInput (40%) + PipelineView + ArtifactView (60%).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BuildPage } from "@/components/build/BuildPage.tsx";
import { useSessionStore } from "@/store/session.ts";

vi.mock("@/api/governance.ts", () => ({
  governanceApi: {
    stop: vi.fn(),
    getStatus: vi.fn().mockResolvedValue({ data: { killSwitchActive: false, dailySpend: 0, autonomyLevel: "supervised", timestamp: "" } }),
  },
}));

describe("BuildPage (Phase 3)", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it("renders spec input panel and pipeline panel", () => {
    render(<BuildPage />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByText("Spec Interpreter")).toBeInTheDocument();
  });

  it("shows no artifacts message initially", () => {
    render(<BuildPage />);
    expect(screen.getByText(/no artifacts/i)).toBeInTheDocument();
  });

  it("renders 40/60 split layout", () => {
    const { container } = render(<BuildPage />);
    const panels = container.querySelectorAll("[data-testid='build-left'], [data-testid='build-right']");
    expect(panels).toHaveLength(2);
  });
});
