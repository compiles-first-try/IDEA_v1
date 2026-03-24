/**
 * AuditTable — filterable history with expand, CSV export, pagination.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuditTable } from "@/components/audit/AuditTable.tsx";

const MOCK_EVENTS = [
  { id: 1, event_id: "e1", timestamp: "2026-03-24T10:00:00Z", agent_id: "code-gen", agent_type: "PRODUCER", action_type: "LLM_CALL", phase: "L3", status: "SUCCESS", model_used: "qwen2.5", tokens_in: 200, tokens_out: 100, duration_ms: 2000, inputs: { spec: "test" }, outputs: { code: "fn()" }, error_message: null },
  { id: 2, event_id: "e2", timestamp: "2026-03-24T10:01:00Z", agent_id: "consensus", agent_type: "VALIDATOR", action_type: "DECISION", phase: "L4", status: "SUCCESS", model_used: null, tokens_in: null, tokens_out: null, duration_ms: 1500, inputs: {}, outputs: { accepted: true }, error_message: null },
  { id: 3, event_id: "e3", timestamp: "2026-03-24T10:02:00Z", agent_id: "repair", agent_type: "PRODUCER", action_type: "LLM_CALL", phase: "L3", status: "FAILURE", model_used: "qwen2.5", tokens_in: 300, tokens_out: 50, duration_ms: 800, inputs: {}, outputs: {}, error_message: "Parse error" },
];

describe("AuditTable (Phase 4)", () => {
  it("renders column headers", () => {
    render(<AuditTable events={MOCK_EVENTS} total={3} page={1} onPageChange={vi.fn()} onFilterChange={vi.fn()} />);
    expect(screen.getByText("Timestamp")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders all event rows", () => {
    render(<AuditTable events={MOCK_EVENTS} total={3} page={1} onPageChange={vi.fn()} onFilterChange={vi.fn()} />);
    expect(screen.getByText("code-gen")).toBeInTheDocument();
    expect(screen.getByText("consensus")).toBeInTheDocument();
    expect(screen.getByText("repair")).toBeInTheDocument();
  });

  it("renders filter inputs", () => {
    render(<AuditTable events={MOCK_EVENTS} total={3} page={1} onPageChange={vi.fn()} onFilterChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/agent/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/action/i)).toBeInTheDocument();
  });

  it("clicking a row expands event detail", () => {
    render(<AuditTable events={MOCK_EVENTS} total={3} page={1} onPageChange={vi.fn()} onFilterChange={vi.fn()} />);
    fireEvent.click(screen.getByText("code-gen"));
    expect(screen.getByTestId("event-detail-e1")).toBeInTheDocument();
  });

  it("renders export CSV button", () => {
    render(<AuditTable events={MOCK_EVENTS} total={3} page={1} onPageChange={vi.fn()} onFilterChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
  });

  it("renders pagination controls", () => {
    render(<AuditTable events={MOCK_EVENTS} total={120} page={1} onPageChange={vi.fn()} onFilterChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  });

  it("calls onFilterChange when filter input changes", () => {
    const onFilter = vi.fn();
    render(<AuditTable events={MOCK_EVENTS} total={3} page={1} onPageChange={vi.fn()} onFilterChange={onFilter} />);
    fireEvent.change(screen.getByPlaceholderText(/agent/i), { target: { value: "code-gen" } });
    expect(onFilter).toHaveBeenCalled();
  });
});
