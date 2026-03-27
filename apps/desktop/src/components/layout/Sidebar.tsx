import { useLayoutStore, type NavRoute } from "@/store/layout.ts";
import { ThemeToggle } from "@/components/shared/ThemeToggle.tsx";

interface NavItem {
  route: NavRoute;
  label: string;
  icon: string;
  hint: string;
}

const NAV_ITEMS: NavItem[] = [
  { route: "build", label: "Build", icon: "\u2699", hint: "Submit specs, generate code" },
  { route: "audit", label: "Audit", icon: "\ud83d\udccb", hint: "View all agent activity" },
  { route: "agents", label: "Agents", icon: "\ud83e\udd16", hint: "Manage agent roster" },
  { route: "models", label: "Models", icon: "\ud83e\udde0", hint: "LLMs and routing tiers" },
  { route: "improve", label: "Improve", icon: "\ud83d\udcc8", hint: "Run self-improvement cycles" },
  { route: "docs", label: "Knowledge", icon: "\ud83d\udcc4", hint: "Ingest knowledge for agents" },
  { route: "config", label: "Config", icon: "\u26a1", hint: "Spend limits and rules" },
  { route: "feedback", label: "Feedback", icon: "\ud83d\udcac", hint: "Rate generated artifacts" },
];

export function Sidebar() {
  const { sidebarCollapsed, activeRoute, setActiveRoute, toggleSidebar } =
    useLayoutStore();

  const width = sidebarCollapsed ? "w-12" : "w-[220px]";

  return (
    <aside
      className={`${width} flex shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] transition-all duration-200`}
    >
      {/* Navigation items */}
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.route}
            onClick={() => setActiveRoute(item.route)}
            title={item.hint}
            className={`flex items-center gap-3 rounded px-3 py-2 text-left text-sm transition-colors ${
              activeRoute === item.route
                ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] font-medium"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {!sidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Bottom: theme toggle + collapse toggle */}
      <div className="border-t border-[var(--color-border)] p-2">
        {!sidebarCollapsed && (
          <div className="mb-2">
            <ThemeToggle />
          </div>
        )}
        <button
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          className="flex w-full items-center justify-center rounded py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]"
        >
          {sidebarCollapsed ? "»" : "« Collapse"}
        </button>
      </div>
    </aside>
  );
}
