import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { governanceApi } from "@/api/governance.ts";

const DEFAULT_METRICS = {
  overallScores: [] as number[],
  componentScores: {} as Record<string, number>,
  regressionBudget: { used: 0, total: 5 },
  lastCycle: null as { timestamp: string; changes: string; delta: number } | null,
};

export function useImproveMetrics() {
  const query = useQuery({
    queryKey: ["governance-improve-metrics"],
    queryFn: () => governanceApi.getImproveMetrics().then((r) => r.data),
    refetchInterval: 30_000,
  });

  return {
    ...query,
    metrics: query.data ?? DEFAULT_METRICS,
  };
}

export function useTriggerImprove() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => governanceApi.triggerImprove(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-improve-metrics"] });
    },
  });
}
