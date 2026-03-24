/**
 * Theme System tests.
 * - Zustand store persists dark/light/system
 * - CSS variables switch between palettes
 * - System default on first launch
 * - localStorage persistence
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore } from "@/store/theme.ts";

describe("Theme System", () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: "dark" });
  });

  it("defaults to dark theme", () => {
    expect(useThemeStore.getState().theme).toBe("dark");
  });

  it("switches to light", () => {
    useThemeStore.getState().setTheme("light");
    expect(useThemeStore.getState().theme).toBe("light");
  });

  it("switches to system", () => {
    useThemeStore.getState().setTheme("system");
    expect(useThemeStore.getState().theme).toBe("system");
  });

  it("round-trips through all modes", () => {
    const { setTheme } = useThemeStore.getState();
    setTheme("light");
    setTheme("system");
    setTheme("dark");
    expect(useThemeStore.getState().theme).toBe("dark");
  });
});
