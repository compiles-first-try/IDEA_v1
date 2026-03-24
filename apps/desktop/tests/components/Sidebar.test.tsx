/**
 * Sidebar tests.
 * - Renders all 8 navigation items
 * - Clicking a nav item updates active route
 * - Collapse toggle works
 * - Shows ThemeToggle and LayoutToggle at bottom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "@/components/layout/Sidebar.tsx";
import { useLayoutStore } from "@/store/layout.ts";

describe("Sidebar", () => {
  beforeEach(() => {
    useLayoutStore.setState({ sidebarCollapsed: false, activeRoute: "build" });
  });

  it("renders all 8 navigation items", () => {
    render(<Sidebar />);
    for (const label of ["Build", "Audit", "Agents", "Models", "Improve", "Docs", "Config", "Feedback"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("clicking a nav item updates active route in store", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByText("Audit"));
    expect(useLayoutStore.getState().activeRoute).toBe("audit");
  });

  it("has a collapse toggle button", () => {
    render(<Sidebar />);
    expect(screen.getByRole("button", { name: /toggle sidebar/i })).toBeInTheDocument();
  });

  it("collapse toggle updates store", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(true);
  });

  it("renders theme toggle", () => {
    render(<Sidebar />);
    expect(screen.getByRole("button", { name: /dark/i })).toBeInTheDocument();
  });
});
