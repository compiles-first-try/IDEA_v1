import type { PipelineStage, StageStatus } from "@/store/session.ts";

interface PipelineViewProps {
  stages: PipelineStage[];
}

interface StageInfo {
  description: string;
  model: string;
  why: string;
}

const STAGE_INFO: Record<string, StageInfo> = {
  "spec-interpreter": {
    description: "Reads your specification and extracts a structured generation target: function name, parameters, return type, requirements, and edge cases.",
    model: "qwen2.5-coder:14b (local)",
    why: "Turns natural language into a machine-readable blueprint.",
  },
  "router": {
    description: "Classifies the task by complexity (Tier 1-3) and selects which model handles each downstream stage.",
    model: "Pattern-based classifier",
    why: "Routes simple tasks to cheap/fast local models, complex tasks to cloud models.",
  },
  "code-gen": {
    description: "Generates implementation code from the structured target. Validates the output parses as valid TypeScript AST.",
    model: "qwen2.5-coder:14b (local)",
    why: "Produces the actual code artifact from the blueprint.",
  },
  "test-gen": {
    description: "Generates test cases that cover the requirements. Tests are written by a different model call than the code — never self-validated.",
    model: "qwen2.5-coder:14b (local)",
    why: "Test-first: tests are generated independently to avoid confirmation bias.",
  },
  "quality-gates": {
    description: "Runs AST validation (does it parse?), coverage analysis (do tests cover requirements?), and gameability checks (are tests too trivial?).",
    model: "Local static analysis",
    why: "Catches broken code and shallow tests before they reach review.",
  },
  "consensus": {
    description: "Three independent critics (correctness, adversarial, efficiency) review the code. 2/3 must agree to pass.",
    model: "Multi-model consensus",
    why: "No single agent evaluates its own output. Adversarial review catches what tests miss.",
  },
};

const STATUS_CONFIG: Record<StageStatus, { bg: string; border: string; dot: string; text: string; label: string }> = {
  pending: {
    bg: "bg-[var(--color-bg-secondary)]",
    border: "border-[var(--color-border)]",
    dot: "bg-[var(--color-text-secondary)]",
    text: "text-[var(--color-text-secondary)]",
    label: "Waiting",
  },
  running: {
    bg: "bg-[var(--color-accent-amber)]/5",
    border: "border-[var(--color-accent-amber)]",
    dot: "bg-[var(--color-accent-amber)] animate-pulse",
    text: "text-[var(--color-accent-amber)]",
    label: "Running",
  },
  passed: {
    bg: "bg-[var(--color-accent-green)]/5",
    border: "border-[var(--color-accent-green)]/40",
    dot: "bg-[var(--color-accent-green)]",
    text: "text-[var(--color-accent-green)]",
    label: "Complete",
  },
  failed: {
    bg: "bg-[var(--color-accent-red)]/5",
    border: "border-[var(--color-accent-red)]/40",
    dot: "bg-[var(--color-accent-red)]",
    text: "text-[var(--color-accent-red)]",
    label: "Failed",
  },
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StageCard({ stage, isLast }: { stage: PipelineStage; isLast: boolean }) {
  const config = STATUS_CONFIG[stage.status];
  const info = STAGE_INFO[stage.id];

  return (
    <div className="flex flex-col items-center">
      {/* Stage card */}
      <div className={`w-full rounded-lg border ${config.border} ${config.bg} p-3 transition-all duration-300`}>
        {/* Header row */}
        <div className="flex items-center gap-2">
          <span
            data-testid={`stage-status-${stage.status}`}
            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${config.dot}`}
          />
          <span className={`text-sm font-semibold ${config.text}`}>{stage.name}</span>
          <span className={`ml-auto text-[10px] ${config.text}`}>{config.label}</span>
        </div>

        {/* Description */}
        {info && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
            {info.description}
          </p>
        )}

        {/* Runtime details — shown when running or complete */}
        {(stage.status === "running" || stage.status === "passed" || stage.status === "failed") && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-[var(--color-text-secondary)]">
            {stage.modelUsed && (
              <span className="rounded bg-[var(--color-bg-elevated)] px-1.5 py-0.5">{stage.modelUsed}</span>
            )}
            {stage.durationMs !== null && (
              <span>{formatDuration(stage.durationMs)}</span>
            )}
            {stage.tokensIn !== null && stage.tokensOut !== null && (
              <span>{stage.tokensIn} in / {stage.tokensOut} out tokens</span>
            )}
          </div>
        )}

        {/* Pre-run info — shown when pending */}
        {stage.status === "pending" && info && (
          <div className="mt-2 text-[10px] text-[var(--color-text-secondary)]">
            Model: {info.model}
          </div>
        )}
      </div>

      {/* Arrow connector */}
      {!isLast && (
        <div className="flex flex-col items-center py-1">
          <div className="h-3 w-px bg-[var(--color-border)]" />
          <div className="h-0 w-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-[var(--color-border)]" />
        </div>
      )}
    </div>
  );
}

export function PipelineView({ stages }: PipelineViewProps) {
  const allPending = stages.every((s) => s.status === "pending");
  const anyRunning = stages.some((s) => s.status === "running");

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Pipeline {anyRunning ? "— Running" : allPending ? "— Ready" : "— Complete"}
        </h4>
        {allPending && (
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            Submit a spec to start the pipeline
          </span>
        )}
      </div>

      {/* Stage flow */}
      {stages.map((stage, i) => (
        <StageCard key={stage.id} stage={stage} isLast={i === stages.length - 1} />
      ))}
    </div>
  );
}
