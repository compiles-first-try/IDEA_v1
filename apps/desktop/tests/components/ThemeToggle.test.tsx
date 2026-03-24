/**
 * Contract 5: ThemeToggle
 * - Switches between dark/light/system modes
 * - Persists selection to Zustand store
 * - Applies correct class to root element
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "@/components/shared/ThemeToggle.tsx";
import { useThemeStore } from "@/store/theme.ts";

describe("Contract 5: ThemeToggle", () => {
  it("renders theme option buttons", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /system/i })).toBeInTheDocument();
  });

  it("switches to light mode and updates store", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /light/i }));
    expect(useThemeStore.getState().theme).toBe("light");
  });

  it("switches to dark mode and updates store", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /dark/i }));
    expect(useThemeStore.getState().theme).toBe("dark");
  });

  it("switches to system mode and updates store", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /system/i }));
    expect(useThemeStore.getState().theme).toBe("system");
  });
});
