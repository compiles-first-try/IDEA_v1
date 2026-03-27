import { useMutation, useQueryClient } from "@tanstack/react-query";
import { governanceApi } from "@/api/governance.ts";

export function useKillSwitch() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => governanceApi.stop(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-status"] });
    },
  });

  return {
    ...mutation,
    activate: () => mutation.mutateAsync(),
  };
}
