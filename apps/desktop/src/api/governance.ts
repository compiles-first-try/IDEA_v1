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
}

export interface AuditResponse {
  events: AuditEvent[];
  count: number;
}

export interface ConfigResponse {
  maxDailySpendUsd: number;
  autonomyLevel: string;
}

export const governanceApi = {
  getHealth: () => apiClient.get<HealthResponse>("/health"),
  getStatus: () => apiClient.get<StatusResponse>("/governance/status"),
  getAudit: (limit = 20) =>
    apiClient.get<AuditResponse>(`/governance/audit?limit=${limit}`),
  stop: () => apiClient.post("/governance/stop"),
  getConfig: () => apiClient.get<ConfigResponse>("/governance/config"),
  patchConfig: (data: Partial<ConfigResponse>) =>
    apiClient.patch<ConfigResponse>("/governance/config", data),
  triggerImprove: () => apiClient.post("/governance/improve"),
};
