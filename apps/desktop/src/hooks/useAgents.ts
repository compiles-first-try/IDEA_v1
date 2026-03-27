import { useQuery } from "@tanstack/react-query";
import { governanceApi } from "@/api/governance.ts";

export function useAgents() {
  const query = useQuery({
    queryKey: ["governance-agents"],
    queryFn: () => governanceApi.getAgents().then((r) => r.data),
    refetchInterval: 30_000,
  });

  return {
    ...query,
    agents: query.data?.agents ?? [],
  };
}
