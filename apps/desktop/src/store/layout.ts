import { create } from "zustand";

export type NavRoute =
  | "build"
  | "audit"
  | "agents"
  | "models"
  | "improve"
  | "docs"
  | "config"
  | "feedback";

interface LayoutState {
  sidebarCollapsed: boolean;
  activeRoute: NavRoute;
  toggleSidebar: () => void;
  setActiveRoute: (route: NavRoute) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  sidebarCollapsed: false,
  activeRoute: "build",
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setActiveRoute: (route) => set({ activeRoute: route }),
}));
