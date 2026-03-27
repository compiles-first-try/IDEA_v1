import { useMutation, useQueryClient } from "@tanstack/react-query";
import { governanceApi } from "@/api/governance.ts";

export function useKillSwitch() {
  const queryClient = useQueryClient();

  const stopMutation = useMutation({
    mutationFn: () => governanceApi.stop(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-status"] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => governanceApi.resume(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-status"] });
    },
  });

  return {
    ...stopMutation,
    activate: () => stopMutation.mutateAsync(),
    resume: () => resumeMutation.mutateAsync(),
    isResuming: resumeMutation.isPending,
  };
}
