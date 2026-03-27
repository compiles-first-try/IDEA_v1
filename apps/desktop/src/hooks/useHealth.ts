import { useQuery } from "@tanstack/react-query";
import { governanceApi } from "@/api/governance.ts";

export function useHealth() {
  const query = useQuery({
    queryKey: ["health"],
    queryFn: () => governanceApi.getHealth().then((r) => r.data),
    refetchInterval: 10_000,
  });

  return {
    ...query,
    isHealthy: query.data?.status === "ok",
  };
}
