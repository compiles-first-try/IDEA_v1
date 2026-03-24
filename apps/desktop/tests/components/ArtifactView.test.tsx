/**
 * ArtifactView — 4 tabbed output viewer.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ArtifactView } from "@/components/build/ArtifactView.tsx";

const ARTIFACTS = {
  generatedCode: "function add(a: number, b: number): number { return a + b; }",
  generatedTests: "it('adds', () => expect(add(1,2)).toBe(3))",
  qualityGates: [
    { name: "AST Validation", result: "pass", details: "Zero errors" },
    { name: "Metamorphic", result: "pass", details: "0 violations" },
    { name: "Consensus", result: "pass", details: "2/2 agreed" },
  ],
  auditTrail: [
    { timestamp: "12:00:01", agent: "spec-interpreter", action: "LLM_CALL", model: "qwen2.5", duration: "16s" },
    { timestamp: "12:00:03", agent: "code-generator", action: "LLM_CALL", model: "qwen2.5", duration: "2s" },
  ],
};

describe("ArtifactView (Phase 3)", () => {
  it("renders 4 tabs", () => {
    render(<ArtifactView artifacts={ARTIFACTS} />);
    expect(screen.getByRole("button", { name: /code/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tests/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /quality/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /audit/i })).toBeInTheDocument();
  });

  it("shows generated code by default", () => {
    render(<ArtifactView artifacts={ARTIFACTS} />);
    expect(screen.getByText(/function add/)).toBeInTheDocument();
  });

  it("switches to tests tab", () => {
    render(<ArtifactView artifacts={ARTIFACTS} />);
    fireEvent.click(screen.getByRole("button", { name: /tests/i }));
    expect(screen.getByText(/adds/)).toBeInTheDocument();
  });

  it("switches to quality gates tab and shows table", () => {
    render(<ArtifactView artifacts={ARTIFACTS} />);
    fireEvent.click(screen.getByRole("button", { name: /quality/i }));
    expect(screen.getByText("AST Validation")).toBeInTheDocument();
    expect(screen.getByText("Metamorphic")).toBeInTheDocument();
    expect(screen.getByText("Consensus")).toBeInTheDocument();
  });

  it("switches to audit trail tab and shows table", () => {
    render(<ArtifactView artifacts={ARTIFACTS} />);
    fireEvent.click(screen.getByRole("button", { name: /audit/i }));
    expect(screen.getByText("spec-interpreter")).toBeInTheDocument();
    expect(screen.getByText("code-generator")).toBeInTheDocument();
  });

  it("shows empty state when no artifacts", () => {
    render(<ArtifactView artifacts={null} />);
    expect(screen.getByText(/no artifacts/i)).toBeInTheDocument();
  });
});
