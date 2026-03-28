import { create } from "zustand";

export type StageStatus = "pending" | "running" | "passed" | "failed";
export type ReasoningMode = "sequential" | "feynman" | "parallel-dag";

export interface PipelineStage {
  id: string;
  name: string;
  status: StageStatus;
  modelUsed: string | null;
  durationMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
}

export interface QualityGateResult {
  name: string;
  result: string;
  details: string;
}

export interface AuditTrailEntry {
  timestamp: string;
  agent: string;
  action: string;
  model: string;
  duration: string;
}

export interface BuildArtifacts {
  generatedCode: string;
  generatedTests: string;
  qualityGates: QualityGateResult[];
  auditTrail: AuditTrailEntry[];
}

const DEFAULT_STAGES: PipelineStage[] = [
  { id: "spec-interpreter", name: "Spec Interpreter", status: "pending", modelUsed: null, durationMs: null, tokensIn: null, tokensOut: null },
  { id: "router", name: "Router Decision", status: "pending", modelUsed: null, durationMs: null, tokensIn: null, tokensOut: null },
  { id: "code-gen", name: "Code Generator", status: "pending", modelUsed: null, durationMs: null, tokensIn: null, tokensOut: null },
  { id: "test-gen", name: "Test Generator", status: "pending", modelUsed: null, durationMs: null, tokensIn: null, tokensOut: null },
  { id: "quality-gates", name: "Quality Gates", status: "pending", modelUsed: null, durationMs: null, tokensIn: null, tokensOut: null },
  { id: "consensus", name: "Consensus", status: "pending", modelUsed: null, durationMs: null, tokensIn: null, tokensOut: null },
];

interface ClarificationState {
  questions: string[];
  answered: boolean;
}

interface SessionState {
  spec: string;
  reasoningMode: ReasoningMode;
  busy: boolean;
  stages: PipelineStage[];
  artifacts: BuildArtifacts | null;
  clarification: ClarificationState | null;
  setSpec: (spec: string) => void;
  setReasoningMode: (mode: ReasoningMode) => void;
  startBuild: () => void;
  updateStage: (id: string, update: Partial<PipelineStage>) => void;
  completeBuild: (artifacts: BuildArtifacts) => void;
  setClarification: (questions: string[]) => void;
  clearClarification: () => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  spec: "",
  reasoningMode: "sequential",
  busy: false,
  stages: DEFAULT_STAGES.map((s) => ({ ...s })),
  artifacts: null,
  clarification: null,

  setSpec: (spec) => set({ spec }),
  setReasoningMode: (mode) => set({ reasoningMode: mode }),

  startBuild: () =>
    set({
      busy: true,
      artifacts: null,
      stages: DEFAULT_STAGES.map((s) => ({ ...s })),
    }),

  updateStage: (id, update) =>
    set((state) => ({
      stages: state.stages.map((s) => (s.id === id ? { ...s, ...update } : s)),
    })),

  completeBuild: (artifacts) => set({ busy: false, artifacts, clarification: null }),

  setClarification: (questions) => set({ clarification: { questions, answered: false } }),
  clearClarification: () => set({ clarification: null }),

  reset: () =>
    set({
      spec: "",
      reasoningMode: "sequential",
      busy: false,
      stages: DEFAULT_STAGES.map((s) => ({ ...s })),
      artifacts: null,
      clarification: null,
    }),
}));
