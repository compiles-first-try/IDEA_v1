/**
 * PipelineView — live pipeline stage visualization.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineView } from "@/components/build/PipelineView.tsx";

const STAGES = [
  { id: "spec-interpreter", name: "Spec Interpreter", status: "passed" as const, modelUsed: "qwen2.5-coder:14b", durationMs: 16000, tokensIn: 228, tokensOut: 464 },
  { id: "router", name: "Router Decision", status: "passed" as const, modelUsed: null, durationMs: 2, tokensIn: null, tokensOut: null },
  { id: "code-gen", name: "Code Generator", status: "running" as const, modelUsed: "qwen2.5-coder:14b", durationMs: null, tokensIn: null, tokensOut: null },
  { id: "test-gen", name: "Test Generator", status: "pending" as const, modelUsed: null, durationMs: null, tokensIn: null, tokensOut: null },
  { id: "quality-gates", name: "Quality Gates", status: "pending" as const, modelUsed: null, durationMs: null, tokensIn: null, tokensOut: null },
  { id: "consensus", name: "Consensus", status: "pending" as const, modelUsed: null, durationMs: null, tokensIn: null, tokensOut: null },
];

describe("PipelineView (Phase 3)", () => {
  it("renders all 6 pipeline stages", () => {
    render(<PipelineView stages={STAGES} />);
    expect(screen.getByText("Spec Interpreter")).toBeInTheDocument();
    expect(screen.getByText("Router Decision")).toBeInTheDocument();
    expect(screen.getByText("Code Generator")).toBeInTheDocument();
    expect(screen.getByText("Test Generator")).toBeInTheDocument();
    expect(screen.getByText("Quality Gates")).toBeInTheDocument();
    expect(screen.getByText("Consensus")).toBeInTheDocument();
  });

  it("shows status indicators for each stage", () => {
    render(<PipelineView stages={STAGES} />);
    // Passed stages should have a green indicator
    const passed = screen.getAllByTestId("stage-status-passed");
    expect(passed).toHaveLength(2);
    // Running should have an indicator
    expect(screen.getByTestId("stage-status-running")).toBeInTheDocument();
    // Pending stages
    expect(screen.getAllByTestId("stage-status-pending")).toHaveLength(3);
  });

  it("displays model used for completed stages", () => {
    render(<PipelineView stages={STAGES} />);
    expect(screen.getAllByText("qwen2.5-coder:14b").length).toBeGreaterThanOrEqual(1);
  });

  it("displays duration for completed stages", () => {
    render(<PipelineView stages={STAGES} />);
    expect(screen.getByText(/16\.0s/)).toBeInTheDocument();
  });
});
