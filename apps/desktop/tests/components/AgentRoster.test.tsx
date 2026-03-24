/**
 * AgentRoster — 3 discovery surfaces + agent profile modal.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentRoster } from "@/components/agents/AgentRoster.tsx";

const MOCK_AGENTS = [
  { id: "spec-interpreter", name: "Spec Interpreter", role: "PRODUCER", status: "ACTIVE", capabilities: ["spec-parsing", "nlp"], successRate: 0.95, totalRuns: 42 },
  { id: "code-generator", name: "Code Generator", role: "PRODUCER", status: "ACTIVE", capabilities: ["code-generation", "ast-validation"], successRate: 0.88, totalRuns: 37 },
  { id: "consensus-gate", name: "Consensus Gate", role: "VALIDATOR", status: "ACTIVE", capabilities: ["quality-gate", "multi-model"], successRate: 1.0, totalRuns: 20 },
];

describe("AgentRoster (Phase 2)", () => {
  it("renders search tab as default", () => {
    render(<AgentRoster agents={MOCK_AGENTS} />);
    expect(screen.getByPlaceholderText(/find agents/i)).toBeInTheDocument();
  });

  it("renders all agents in search view", () => {
    render(<AgentRoster agents={MOCK_AGENTS} />);
    expect(screen.getByText("Spec Interpreter")).toBeInTheDocument();
    expect(screen.getByText("Code Generator")).toBeInTheDocument();
    expect(screen.getByText("Consensus Gate")).toBeInTheDocument();
  });

  it("switches to topology tab", () => {
    render(<AgentRoster agents={MOCK_AGENTS} />);
    fireEvent.click(screen.getByRole("button", { name: /topology/i }));
    expect(screen.getByTestId("topology-view")).toBeInTheDocument();
  });

  it("switches to matrix tab", () => {
    render(<AgentRoster agents={MOCK_AGENTS} />);
    fireEvent.click(screen.getByRole("button", { name: /matrix/i }));
    expect(screen.getByTestId("matrix-view")).toBeInTheDocument();
  });

  it("clicking an agent opens profile modal", () => {
    render(<AgentRoster agents={MOCK_AGENTS} />);
    fireEvent.click(screen.getByText("Spec Interpreter"));
    expect(screen.getByTestId("agent-profile-modal")).toBeInTheDocument();
    expect(screen.getByText("spec-interpreter")).toBeInTheDocument();
  });

  it("shows V2 placeholder for agent creation", () => {
    render(<AgentRoster agents={MOCK_AGENTS} />);
    expect(screen.getByText(/coming in v2/i)).toBeInTheDocument();
  });

  it("filters agents by search text", () => {
    render(<AgentRoster agents={MOCK_AGENTS} />);
    fireEvent.change(screen.getByPlaceholderText(/find agents/i), { target: { value: "consensus" } });
    expect(screen.getByText("Consensus Gate")).toBeInTheDocument();
    expect(screen.queryByText("Spec Interpreter")).not.toBeInTheDocument();
  });
});
