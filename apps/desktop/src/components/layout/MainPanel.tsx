import { useLayoutStore, type NavRoute } from "@/store/layout.ts";
import { BuildPage } from "@/components/build/BuildPage.tsx";
import { AuditPage } from "@/components/audit/AuditPage.tsx";
import { AgentRoster } from "@/components/agents/AgentRoster.tsx";
import { ModelManager } from "@/components/inference/ModelManager.tsx";
import { ImproveCycle } from "@/components/improvement/ImproveCycle.tsx";
import { KnowledgeBase } from "@/components/knowledge/KnowledgeBase.tsx";
import { DocIngestion } from "@/components/knowledge/DocIngestion.tsx";
import { ConfigPanelFull } from "@/components/governance/ConfigPanelFull.tsx";
import { FeedbackPanel } from "@/components/feedback/FeedbackPanel.tsx";

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

function RouteContent({ route }: { route: NavRoute }) {
  switch (route) {
    case "build":
      return <BuildPage />;
    case "audit":
      return <AuditPage />;
    case "agents":
      return <AgentRoster agents={[]} />;
    case "models":
      return (
        <ModelManager
          data={{
            ollama: [],
            anthropicKeySet: false,
            anthropicModels: ["claude-sonnet-4-6-20250514", "claude-haiku-4-5-20251001"],
            routerTiers: [
              { tier: "TRIVIAL", model: "llama3.3:8b", costPerCall: "$0.00", callsToday: 0 },
              { tier: "STANDARD", model: "qwen2.5-coder:14b", costPerCall: "$0.00", callsToday: 0 },
              { tier: "COMPLEX", model: "claude-haiku-4-5-20251001", costPerCall: "~$0.001", callsToday: 0 },
              { tier: "CRITICAL", model: "claude-sonnet-4-6-20250514", costPerCall: "~$0.015", callsToday: 0 },
            ],
          }}
        />
      );
    case "improve":
      return (
        <ImproveCycle
          metrics={{
            overallScores: [],
            componentScores: {},
            regressionBudget: { used: 0, total: 5 },
            lastCycle: null,
          }}
          onTrigger={() => {}}
          running={false}
        />
      );
    case "docs":
      return (
        <div className="space-y-8">
          <DocIngestion onIngest={() => {}} />
          <KnowledgeBase docs={[]} onDelete={() => {}} onSearch={() => {}} searchResults={[]} />
        </div>
      );
    case "config":
      return (
        <ConfigPanelFull
          config={{
            maxDailySpendUsd: 10,
            pauseThresholdUsd: 20,
            perCallCriticalUsd: 0.05,
            autonomyLevel: "supervised",
            modelTiers: {
              TRIVIAL: "llama3.3:8b",
              STANDARD: "qwen2.5-coder:14b",
              COMPLEX: "claude-haiku-4-5-20251001",
              CRITICAL: "claude-sonnet-4-6-20250514",
            },
          }}
          onSave={async () => {}}
        />
      );
    case "feedback":
      return (
        <FeedbackPanel
          artifacts={[]}
          summary={{ total: 0, accepted: 0, acceptedWithNote: 0, pendingClarification: 0, overridden: 0 }}
          onSubmit={() => {}}
          onConfirm={() => {}}
        />
      );
  }
}

export function MainPanel() {
  const activeRoute = useLayoutStore((s) => s.activeRoute);

  return (
    <main className="flex-1 overflow-auto bg-[var(--color-bg-primary)] p-6">
      <div data-testid={`page-${activeRoute}`}>
        <h2 className="mb-4 text-lg font-semibold">{PAGE_TITLES[activeRoute]}</h2>
        <RouteContent route={activeRoute} />
      </div>
    </main>
  );
}
