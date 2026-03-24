/**
 * DocIngestion — drag-drop, URL input, tags, processing status.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocIngestion } from "@/components/knowledge/DocIngestion.tsx";

describe("DocIngestion (Phase 5)", () => {
  it("renders drop zone area", () => {
    render(<DocIngestion onIngest={vi.fn()} />);
    expect(screen.getByText(/drag.*drop|drop files/i)).toBeInTheDocument();
  });

  it("renders URL input", () => {
    render(<DocIngestion onIngest={vi.fn()} />);
    expect(screen.getByPlaceholderText(/url/i)).toBeInTheDocument();
  });

  it("renders tags input", () => {
    render(<DocIngestion onIngest={vi.fn()} />);
    expect(screen.getByPlaceholderText(/tags/i)).toBeInTheDocument();
  });

  it("ingest button disabled when no content", () => {
    render(<DocIngestion onIngest={vi.fn()} />);
    expect(screen.getByRole("button", { name: /ingest/i })).toBeDisabled();
  });

  it("ingest button enabled with URL input", () => {
    render(<DocIngestion onIngest={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/url/i), { target: { value: "https://example.com/docs" } });
    expect(screen.getByRole("button", { name: /ingest/i })).toBeEnabled();
  });

  it("calls onIngest with URL and tags", () => {
    const onIngest = vi.fn();
    render(<DocIngestion onIngest={onIngest} />);
    fireEvent.change(screen.getByPlaceholderText(/url/i), { target: { value: "https://api.example.com" } });
    fireEvent.change(screen.getByPlaceholderText(/tags/i), { target: { value: "api, docs" } });
    fireEvent.click(screen.getByRole("button", { name: /ingest/i }));
    expect(onIngest).toHaveBeenCalledWith({ url: "https://api.example.com", tags: "api, docs" });
  });

  it("shows processing status when provided", () => {
    render(<DocIngestion onIngest={vi.fn()} processingStatus="embedding" />);
    expect(screen.getByText(/embedding/i)).toBeInTheDocument();
  });
});
