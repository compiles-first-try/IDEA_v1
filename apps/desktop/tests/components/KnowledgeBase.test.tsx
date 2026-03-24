/**
 * KnowledgeBase — document table, semantic search, V2 placeholder.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KnowledgeBase } from "@/components/knowledge/KnowledgeBase.tsx";

const MOCK_DOCS = [
  { id: "d1", name: "API Reference", type: "API docs", dateIngested: "2026-03-20", chunkCount: 42, lastRetrieved: "2026-03-24" },
  { id: "d2", name: "System Architecture", type: "system docs", dateIngested: "2026-03-18", chunkCount: 15, lastRetrieved: "2026-03-23" },
];

describe("KnowledgeBase (Phase 5)", () => {
  it("renders document table with columns", () => {
    render(<KnowledgeBase docs={MOCK_DOCS} onDelete={vi.fn()} onSearch={vi.fn()} searchResults={[]} />);
    expect(screen.getByText("API Reference")).toBeInTheDocument();
    expect(screen.getByText("System Architecture")).toBeInTheDocument();
  });

  it("renders delete button per document", () => {
    render(<KnowledgeBase docs={MOCK_DOCS} onDelete={vi.fn()} onSearch={vi.fn()} searchResults={[]} />);
    const delBtns = screen.getAllByRole("button", { name: /delete/i });
    expect(delBtns).toHaveLength(2);
  });

  it("renders semantic search input", () => {
    render(<KnowledgeBase docs={MOCK_DOCS} onDelete={vi.fn()} onSearch={vi.fn()} searchResults={[]} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it("shows search results with relevance scores", () => {
    render(<KnowledgeBase docs={MOCK_DOCS} onDelete={vi.fn()} onSearch={vi.fn()}
      searchResults={[{ content: "Found chunk text", score: 0.92 }]} />);
    expect(screen.getByText(/found chunk text/i)).toBeInTheDocument();
    expect(screen.getByText(/0\.92/)).toBeInTheDocument();
  });

  it("shows V2 placeholder for ontology editor", () => {
    render(<KnowledgeBase docs={MOCK_DOCS} onDelete={vi.fn()} onSearch={vi.fn()} searchResults={[]} />);
    expect(screen.getByText(/coming in v2/i)).toBeInTheDocument();
  });
});
