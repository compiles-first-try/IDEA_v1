import { useLayoutStore, type NavRoute } from "@/store/layout.ts";

const PAGE_TITLES: Record<NavRoute, string> = {
  build: "Build",
  audit: "Audit Log",
  agents: "Agent Roster",
  models: "Model Management",
  improve: "Self-Improvement",
  docs: "Knowledge Base",
  config: "Configuration",
  feedback: "Feedback",
};

export function MainPanel() {
  const activeRoute = useLayoutStore((s) => s.activeRoute);

  return (
    <main className="flex-1 overflow-auto bg-[var(--color-bg-primary)] p-6">
      <div data-testid={`page-${activeRoute}`}>
        <h2 className="mb-4 text-lg font-semibold">{PAGE_TITLES[activeRoute]}</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {PAGE_TITLES[activeRoute]} panel — content coming in next phase.
        </p>
      </div>
    </main>
  );
}
