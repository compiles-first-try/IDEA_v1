import { useQuery } from "@tanstack/react-query";
import { governanceApi, type AuditEvent } from "@/api/governance.ts";

const PAGE_SIZE = 50;

interface AuditHistoryParams {
  page?: number;
  agentId?: string;
  actionType?: string;
  status?: string;
}

export function useAuditHistory(params: AuditHistoryParams = {}) {
  const { page = 1, agentId, actionType, status } = params;

  const query = useQuery({
    queryKey: ["governance-audit", { agentId, actionType, status, page }],
    queryFn: () =>
      governanceApi
        .getAudit({
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          agentId,
          actionType,
          status,
        })
        .then((r) => r.data),
  });

  return {
    ...query,
    events: (query.data?.events ?? []) as AuditEvent[],
    total: query.data?.total ?? 0,
    pageSize: PAGE_SIZE,
  };
}
