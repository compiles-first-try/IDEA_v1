import { apiClient } from "./client.ts";

export interface HealthResponse {
  status: string;
  timestamp: string;
}

export interface StatusResponse {
  killSwitchActive: boolean;
  dailySpend: number;
  autonomyLevel: string;
  timestamp: string;
}

export interface AuditEvent {
  id: number;
  event_id: string;
  timestamp: string;
  agent_id: string;
  agent_type: string;
  action_type: string;
  phase: string | null;
  status: string;
  model_used: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  duration_ms: number | null;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error_message: string | null;
  reasoning_trace?: string | null;
}

export interface AuditFilters {
  limit?: number;
  offset?: number;
  agentId?: string;
  actionType?: string;
  status?: string;
}

export interface AuditResponse {
  events: AuditEvent[];
  total: number;
  count: number;
}

export interface ConfigResponse {
  maxDailySpendUsd: number;
  autonomyLevel: string;
}

export interface OllamaModel {
  name: string;
  size: string;
  modifiedAt: string;
}

export interface RouterTier {
  tier: string;
  model: string;
  costPerCall: string;
  callsToday: number;
}

export interface ModelsResponse {
  ollama: OllamaModel[];
  ollamaReachable: boolean;
  anthropicKeySet: boolean;
  anthropicModels: string[];
  routerTiers: RouterTier[];
}

export interface TestAnthropicResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface DocEntry {
  id: string;
  name: string;
  type: string;
  date_ingested: string;
  chunk_count: number;
  last_retrieved: string | null;
}

export interface DocsResponse {
  docs: DocEntry[];
}

export interface IngestRequest {
  url: string;
  tags?: string;
}

export interface IngestResponse {
  docId: string;
  name: string;
  chunks: number;
}

export interface SearchResult {
  content: string;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface BuildRequest {
  spec: string;
  reasoningMode?: "sequential" | "feynman" | "parallel-dag";
}

export interface BuildResponse {
  buildId: string;
  status: string;
  message: string;
}

export interface AgentEntry {
  id: string;
  name: string;
  role: string;
  status: string;
  capabilities: string[];
  successRate: number;
  totalRuns: number;
}

export interface AgentsResponse {
  agents: AgentEntry[];
}

export interface FeedbackArtifact {
  id: string;
  type: string;
  name: string;
  createdAt: string;
  qualityScore: number;
  userRating: string | null;
  validationStatus: string | null;
}

export interface FeedbackSummary {
  total: number;
  accepted: number;
  acceptedWithNote: number;
  pendingClarification: number;
  overridden: number;
}

export interface ArtifactsResponse {
  artifacts: FeedbackArtifact[];
  summary: FeedbackSummary;
}

export interface FeedbackSubmitRequest {
  artifactId: string;
  rating: "up" | "down";
  tag: "CORRECT" | "INCORRECT" | "PARTIAL" | "EXCELLENT";
  note?: string;
}

export interface FeedbackConfirmRequest {
  artifactId: string;
  action: "confirm" | "update" | "dismiss";
}

export interface ImproveMetrics {
  overallScores: number[];
  componentScores: Record<string, number>;
  regressionBudget: { used: number; total: number };
  lastCycle: { timestamp: string; changes: string; delta: number } | null;
}

export const governanceApi = {
  getHealth: () => apiClient.get<HealthResponse>("/health"),
  getStatus: () => apiClient.get<StatusResponse>("/governance/status"),
  getAudit: (filters: AuditFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.limit != null) params.set("limit", String(filters.limit));
    if (filters.offset != null) params.set("offset", String(filters.offset));
    if (filters.agentId) params.set("agentId", filters.agentId);
    if (filters.actionType) params.set("actionType", filters.actionType);
    if (filters.status) params.set("status", filters.status);
    const qs = params.toString();
    return apiClient.get<AuditResponse>(`/governance/audit${qs ? `?${qs}` : ""}`);
  },
  stop: () => apiClient.post("/governance/stop"),
  resume: () => apiClient.post("/governance/resume"),
  getConfig: () => apiClient.get<ConfigResponse>("/governance/config"),
  patchConfig: (data: Partial<ConfigResponse>) =>
    apiClient.patch<ConfigResponse>("/governance/config", data),
  triggerImprove: () => apiClient.post("/governance/improve"),
  getModels: () => apiClient.get<ModelsResponse>("/governance/models"),
  pullModel: (name: string) =>
    apiClient.post("/governance/models/pull", { name }, { responseType: "stream" }),
  testAnthropic: () =>
    apiClient.post<TestAnthropicResponse>("/governance/models/test-anthropic"),
  getDocs: () => apiClient.get<DocsResponse>("/governance/docs"),
  ingestDoc: (data: IngestRequest) =>
    apiClient.post<IngestResponse>("/governance/docs/ingest", data),
  deleteDoc: (id: string) => apiClient.delete(`/governance/docs/${id}`),
  searchDocs: (query: string, limit = 10) =>
    apiClient.post<SearchResponse>("/governance/docs/search", { query, limit }),
  submitBuild: (data: BuildRequest) =>
    apiClient.post<BuildResponse>("/governance/build", data),
  getAgents: () => apiClient.get<AgentsResponse>("/governance/agents"),
  getArtifacts: () => apiClient.get<ArtifactsResponse>("/governance/artifacts"),
  submitFeedback: (data: FeedbackSubmitRequest) =>
    apiClient.post("/governance/feedback/submit", data),
  confirmFeedback: (data: FeedbackConfirmRequest) =>
    apiClient.post("/governance/feedback/confirm", data),
  getImproveMetrics: () =>
    apiClient.get<ImproveMetrics>("/governance/improve/metrics"),
};
