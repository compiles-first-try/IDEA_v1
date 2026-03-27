import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { governanceApi, type IngestRequest } from "@/api/governance.ts";

export function useDocs() {
  const query = useQuery({
    queryKey: ["governance-docs"],
    queryFn: () => governanceApi.getDocs().then((r) => r.data),
  });

  return {
    ...query,
    docs: query.data?.docs ?? [],
  };
}

export function useIngestDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IngestRequest) => governanceApi.ingestDoc(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-docs"] });
    },
  });
}

export function useDeleteDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => governanceApi.deleteDoc(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-docs"] });
    },
  });
}

export function useSearchDocs() {
  return useMutation({
    mutationFn: (query: string) => governanceApi.searchDocs(query, 10),
  });
}
