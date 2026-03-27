import { useState } from "react";
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
import { useConfig, useSaveConfig } from "@/hooks/useConfig.ts";
import { useModels } from "@/hooks/useModels.ts";
import { useDocs, useIngestDoc, useDeleteDoc, useSearchDocs } from "@/hooks/useDocs.ts";
import { useAgents } from "@/hooks/useAgents.ts";
import { useArtifacts, useSubmitFeedback, useConfirmFeedback } from "@/hooks/useFeedback.ts";
import { useImproveMetrics, useTriggerImprove } from "@/hooks/useImprove.ts";

const PAGE_META: Record<NavRoute, { title: string; description: string }> = {
  build: {
    title: "Build",
    description: "Submit a specification and watch the pipeline generate code, tests, and quality reports. Agents from the Agents tab use Models to do the work, and results appear in Audit.",
  },
  audit: {
    title: "Audit Log",
    description: "Every agent action, LLM call, and decision is logged here. Use filters to investigate builds, track spend, or debug failures.",
  },
  agents: {
    title: "Agent Roster",
    description: "All agents registered in the system. Each agent is assigned a Model tier and shows its success rate from recent Audit events.",
  },
  models: {
    title: "Model Management",
    description: "Local (Ollama) and cloud (Anthropic) LLMs that power agents. The Router assigns tasks to tiers based on complexity \u2014 Config controls spend limits.",
  },
  improve: {
    title: "Self-Improvement",
    description: "Triggers an improvement cycle: measure quality from Audit data, propose changes, test against held-out benchmarks, and apply if better.",
  },
  docs: {
    title: "Knowledge Base",
    description: "Ingest documents here \u2014 they are chunked, embedded, and become retrievable context for agents during Builds.",
  },
  config: {
    title: "Configuration",
    description: "Spend limits, autonomy level, and the locked constitution that governs all agent behavior. Changes here affect Models routing and Build execution.",
  },
  feedback: {
    title: "Feedback",
    description: "Rate generated artifacts. Your feedback feeds into the next Improve cycle, teaching the system which outputs were good and which need work.",
  },
};

function ConfigRoute() {
  const { data: config, isLoading, isError } = useConfig();
  const saveConfig = useSaveConfig();

  if (isLoading) {
    return <p className="text-sm text-[var(--color-text-secondary)]">Loading configuration...</p>;
  }
  if (isError || !config) {
    return <p className="text-sm text-[var(--color-accent-red)]">Failed to load configuration.</p>;
  }

  return (
    <ConfigPanelFull
      config={{
        maxDailySpendUsd: config.maxDailySpendUsd,
        pauseThresholdUsd: config.maxDailySpendUsd * 2,
        perCallCriticalUsd: 0.05,
        autonomyLevel: config.autonomyLevel as "supervised" | "semi-auto" | "full-auto",
        modelTiers: {
          TRIVIAL: "llama3.3:8b",
          STANDARD: "qwen2.5-coder:14b",
          COMPLEX: "claude-haiku-4-5-20251001",
          CRITICAL: "claude-sonnet-4-6-20250514",
        },
      }}
      onSave={async (updates) => {
        await saveConfig.mutateAsync({
          maxDailySpendUsd: updates.maxDailySpendUsd,
          autonomyLevel: updates.autonomyLevel,
        });
      }}
    />
  );
}

function ModelsRoute() {
  const { data, isLoading, isError } = useModels();

  if (isLoading) {
    return <p className="text-sm text-[var(--color-text-secondary)]">Loading models...</p>;
  }
  if (isError || !data) {
    return <p className="text-sm text-[var(--color-accent-red)]">Failed to load models.</p>;
  }

  return (
    <ModelManager
      data={{
        ollama: data.ollama.map((m) => ({
          name: m.name,
          size: m.size,
          lastUsed: m.modifiedAt ? new Date(m.modifiedAt).toLocaleDateString() : "—",
        })),
        anthropicKeySet: data.anthropicKeySet,
        anthropicModels: data.anthropicModels,
        routerTiers: data.routerTiers,
      }}
    />
  );
}

function DocsRoute() {
  const { docs, isLoading } = useDocs();
  const ingestDoc = useIngestDoc();
  const deleteDoc = useDeleteDoc();
  const searchDocs = useSearchDocs();
  const [searchResults, setSearchResults] = useState<Array<{ content: string; score: number }>>([]);

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 text-xs text-[var(--color-text-secondary)]">
        <strong className="text-[var(--color-text-primary)]">How it works:</strong> Documents you ingest are split into chunks, converted to vector embeddings (via Ollama nomic-embed-text), and stored in PostgreSQL. During Builds, agents retrieve relevant chunks via semantic search to inform code generation.
      </div>
      <DocIngestion
        onIngest={async (data) => {
          await ingestDoc.mutateAsync(data);
        }}
        processingStatus={ingestDoc.isPending ? "Ingesting document..." : null}
      />
      {isLoading && <p className="text-xs text-[var(--color-text-secondary)]">Loading documents...</p>}
      <KnowledgeBase
        docs={docs.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          dateIngested: d.date_ingested ? new Date(d.date_ingested).toLocaleDateString() : "—",
          chunkCount: d.chunk_count,
          lastRetrieved: d.last_retrieved ? new Date(d.last_retrieved).toLocaleDateString() : "—",
        }))}
        onDelete={(id) => deleteDoc.mutate(id)}
        onSearch={async (query) => {
          const res = await searchDocs.mutateAsync(query);
          setSearchResults(res.data.results);
        }}
        searchResults={searchResults}
      />
    </div>
  );
}

function ImproveRoute() {
  const { metrics, isLoading } = useImproveMetrics();
  const triggerImprove = useTriggerImprove();

  if (isLoading) {
    return <p className="text-sm text-[var(--color-text-secondary)]">Loading metrics...</p>;
  }

  return (
    <ImproveCycle
      metrics={metrics}
      onTrigger={() => triggerImprove.mutate()}
      running={triggerImprove.isPending}
    />
  );
}

function AgentsRoute() {
  const { agents, isLoading, isError } = useAgents();

  if (isLoading) {
    return <p className="text-sm text-[var(--color-text-secondary)]">Loading agents...</p>;
  }
  if (isError) {
    return <p className="text-sm text-[var(--color-accent-red)]">Failed to load agents.</p>;
  }

  return <AgentRoster agents={agents} />;
}

function FeedbackRoute() {
  const { artifacts, summary, isLoading } = useArtifacts();
  const submitFeedback = useSubmitFeedback();
  const confirmFeedback = useConfirmFeedback();

  if (isLoading) {
    return <p className="text-sm text-[var(--color-text-secondary)]">Loading artifacts...</p>;
  }

  return (
    <FeedbackPanel
      artifacts={artifacts}
      summary={summary}
      onSubmit={(data) => submitFeedback.mutate(data)}
      onConfirm={(artifactId, action) => confirmFeedback.mutate({ artifactId, action })}
    />
  );
}

function RouteContent({ route }: { route: NavRoute }) {
  switch (route) {
    case "build":
      return <BuildPage />;
    case "audit":
      return <AuditPage />;
    case "agents":
      return <AgentsRoute />;
    case "models":
      return <ModelsRoute />;
    case "improve":
      return <ImproveRoute />;
    case "docs":
      return <DocsRoute />;
    case "config":
      return <ConfigRoute />;
    case "feedback":
      return <FeedbackRoute />;
  }
}

export function MainPanel() {
  const activeRoute = useLayoutStore((s) => s.activeRoute);
  const meta = PAGE_META[activeRoute];

  return (
    <main className="flex-1 overflow-auto bg-[var(--color-bg-primary)] p-6">
      <div data-testid={`page-${activeRoute}`}>
        <h2 className="mb-1 text-lg font-semibold">{meta.title}</h2>
        <p className="mb-4 text-xs text-[var(--color-text-secondary)]">{meta.description}</p>
        <RouteContent route={activeRoute} />
      </div>
    </main>
  );
}
