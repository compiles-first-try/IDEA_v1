import { useLayoutStore, type NavRoute } from "@/store/layout.ts";
import { ThemeToggle } from "@/components/shared/ThemeToggle.tsx";

interface NavItem {
  route: NavRoute;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { route: "build", label: "Build", icon: "⚙" },
  { route: "audit", label: "Audit", icon: "📋" },
  { route: "agents", label: "Agents", icon: "🤖" },
  { route: "models", label: "Models", icon: "🧠" },
  { route: "improve", label: "Improve", icon: "📈" },
  { route: "docs", label: "Docs", icon: "📄" },
  { route: "config", label: "Config", icon: "⚡" },
  { route: "feedback", label: "Feedback", icon: "💬" },
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
