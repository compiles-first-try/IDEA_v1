import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  governanceApi,
  type FeedbackSubmitRequest,
  type FeedbackConfirmRequest,
} from "@/api/governance.ts";

const DEFAULT_SUMMARY = {
  total: 0,
  accepted: 0,
  acceptedWithNote: 0,
  pendingClarification: 0,
  overridden: 0,
};

export function useArtifacts() {
  const query = useQuery({
    queryKey: ["governance-artifacts"],
    queryFn: () => governanceApi.getArtifacts().then((r) => r.data),
  });

  return {
    ...query,
    artifacts: query.data?.artifacts ?? [],
    summary: query.data?.summary ?? DEFAULT_SUMMARY,
  };
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FeedbackSubmitRequest) => governanceApi.submitFeedback(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-artifacts"] });
    },
  });
}

export function useConfirmFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FeedbackConfirmRequest) => governanceApi.confirmFeedback(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-artifacts"] });
    },
  });
}
