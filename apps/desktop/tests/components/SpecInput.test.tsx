/**
 * Contract 3: SpecInput
 * - Renders a text area for spec entry (Monaco is mocked in test env)
 * - Submit button is disabled when input is empty
 * - Submit button is enabled when input has text
 * - Calls onSubmit with the spec text
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpecInput } from "@/components/build/SpecInput.tsx";

describe("Contract 3: SpecInput", () => {
  it("renders a text input area and a submit button", () => {
    render(<SpecInput onSubmit={vi.fn()} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /build/i })).toBeInTheDocument();
  });

  it("submit button is disabled when input is empty", () => {
    render(<SpecInput onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /build/i })).toBeDisabled();
  });

  it("submit button is enabled when input has text", () => {
    render(<SpecInput onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Build a calculator" },
    });
    expect(screen.getByRole("button", { name: /build/i })).toBeEnabled();
  });

  it("calls onSubmit with the spec text", () => {
    const onSubmit = vi.fn();
    render(<SpecInput onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Build a calculator" },
    });
    fireEvent.click(screen.getByRole("button", { name: /build/i }));
    expect(onSubmit).toHaveBeenCalledWith("Build a calculator");
  });
});
