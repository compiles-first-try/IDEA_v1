import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { governanceApi } from "@/api/governance.ts";

export function useModels() {
  return useQuery({
    queryKey: ["governance-models"],
    queryFn: () => governanceApi.getModels().then((r) => r.data),
    refetchInterval: 30_000, // refresh model list every 30s
  });
}

export function usePullModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => governanceApi.pullModel(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-models"] });
    },
  });
}

export function useTestAnthropic() {
  return useMutation({
    mutationFn: () => governanceApi.testAnthropic(),
  });
}
