import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { governanceApi, type ConfigResponse } from "@/api/governance.ts";

export function useConfig() {
  return useQuery({
    queryKey: ["governance-config"],
    queryFn: () => governanceApi.getConfig().then((r) => r.data),
  });
}

export function useSaveConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<ConfigResponse>) => governanceApi.patchConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-config"] });
    },
  });
}
