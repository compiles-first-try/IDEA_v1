import { create } from "zustand";

export type Theme = "dark" | "light" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

function resolveEffectiveTheme(theme: Theme): "dark" | "light" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyThemeToDocument(theme: Theme): void {
  if (typeof document === "undefined") return;
  const effective = resolveEffectiveTheme(theme);
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(effective);
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "dark",
  setTheme: (theme) => {
    applyThemeToDocument(theme);
    set({ theme });
  },
}));

// Apply default theme on store creation
applyThemeToDocument("dark");
