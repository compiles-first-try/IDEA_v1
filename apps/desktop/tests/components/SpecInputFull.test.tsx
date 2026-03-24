/**
 * SpecInput (Phase 3) — with reasoning mode selector.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpecInputFull } from "@/components/build/SpecInputFull.tsx";

describe("SpecInput Full (Phase 3)", () => {
  it("renders textarea and Build button", () => {
    render(<SpecInputFull onSubmit={vi.fn()} busy={false} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /build/i })).toBeInTheDocument();
  });

  it("renders reasoning mode selector with 3 options", () => {
    render(<SpecInputFull onSubmit={vi.fn()} busy={false} />);
    expect(screen.getByText(/sequential/i)).toBeInTheDocument();
    expect(screen.getByText(/feynman/i)).toBeInTheDocument();
    expect(screen.getByText(/parallel dag/i)).toBeInTheDocument();
  });

  it("Build disabled when empty", () => {
    render(<SpecInputFull onSubmit={vi.fn()} busy={false} />);
    expect(screen.getByRole("button", { name: /build/i })).toBeDisabled();
  });

  it("Build disabled when busy", () => {
    render(<SpecInputFull onSubmit={vi.fn()} busy={true} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "test" } });
    expect(screen.getByRole("button", { name: /build/i })).toBeDisabled();
  });

  it("Build enabled when has text and not busy", () => {
    render(<SpecInputFull onSubmit={vi.fn()} busy={false} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Build a tool" } });
    expect(screen.getByRole("button", { name: /build/i })).toBeEnabled();
  });

  it("calls onSubmit with spec and reasoning mode", () => {
    const onSubmit = vi.fn();
    render(<SpecInputFull onSubmit={onSubmit} busy={false} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Build X" } });
    fireEvent.click(screen.getByText(/feynman/i));
    fireEvent.click(screen.getByRole("button", { name: /build/i }));
    expect(onSubmit).toHaveBeenCalledWith("Build X", "feynman");
  });
});
