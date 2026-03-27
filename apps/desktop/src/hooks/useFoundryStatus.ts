import { useQuery } from "@tanstack/react-query";
import { governanceApi } from "@/api/governance.ts";

export function useFoundryStatus() {
  return useQuery({
    queryKey: ["governance-status"],
    queryFn: () => governanceApi.getStatus().then((r) => r.data),
    refetchInterval: 5_000,
  });
}
