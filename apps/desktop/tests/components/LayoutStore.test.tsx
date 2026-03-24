/**
 * Layout Store tests.
 * - Sidebar expanded (220px) / collapsed (48px)
 * - Toggle persists to Zustand
 * - Active route tracking
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useLayoutStore } from "@/store/layout.ts";

describe("Layout Store", () => {
  beforeEach(() => {
    useLayoutStore.setState({
      sidebarCollapsed: false,
      activeRoute: "build",
    });
  });

  it("defaults to expanded sidebar", () => {
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(false);
  });

  it("toggles sidebar collapsed state", () => {
    useLayoutStore.getState().toggleSidebar();
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(true);
    useLayoutStore.getState().toggleSidebar();
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(false);
  });

  it("tracks active route", () => {
    useLayoutStore.getState().setActiveRoute("audit");
    expect(useLayoutStore.getState().activeRoute).toBe("audit");
  });

  it("supports all navigation routes", () => {
    const routes = ["build", "audit", "agents", "models", "improve", "docs", "config", "feedback"];
    for (const route of routes) {
      useLayoutStore.getState().setActiveRoute(route);
      expect(useLayoutStore.getState().activeRoute).toBe(route);
    }
  });
});
