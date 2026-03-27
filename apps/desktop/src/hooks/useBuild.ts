import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { governanceApi } from "@/api/governance.ts";
import { useSessionStore, type ReasoningMode, type BuildArtifacts } from "@/store/session.ts";
import { WS_URL } from "@/api/client.ts";

export function useBuild() {
  const [buildId, setBuildId] = useState<string | null>(null);
  const buildIdRef = useRef<string | null>(null);
  const { startBuild, updateStage, completeBuild } = useSessionStore();

  // Listen to WebSocket for stage events matching our buildId
  useEffect(() => {
    if (!buildId) return;
    buildIdRef.current = buildId;

    const ws = new WebSocket(WS_URL);

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type !== "audit_event" || !msg.data) return;

        const event = msg.data;
        // Only process events for our build
        if (event.session_id !== buildIdRef.current) return;

        const stageId = event.inputs?.stageId as string | undefined;

        if (event.action_type === "STAGE_STARTED" && stageId) {
          updateStage(stageId, {
            status: "running",
            modelUsed: event.model_used ?? null,
          });
        }

        if (event.action_type === "STAGE_COMPLETED" && stageId) {
          updateStage(stageId, {
            status: "passed",
            durationMs: event.duration_ms ?? null,
            modelUsed: event.model_used ?? null,
          });
        }

        if (event.action_type === "BUILD_COMPLETED") {
          const outputs = event.outputs ?? {};
          const artifacts: BuildArtifacts = {
            generatedCode: (outputs.generatedCode as string) ?? "",
            generatedTests: (outputs.generatedTests as string) ?? "",
            qualityGates: (outputs.qualityGates as BuildArtifacts["qualityGates"]) ?? [],
            auditTrail: [],
          };
          completeBuild(artifacts);
        }
      } catch {
        /* ignore malformed messages */
      }
    };

    return () => {
      ws.close();
    };
  }, [buildId, updateStage, completeBuild]);

  const mutation = useMutation({
    mutationFn: async ({
      spec,
      reasoningMode,
    }: {
      spec: string;
      reasoningMode: ReasoningMode;
    }) => {
      return governanceApi.submitBuild({ spec, reasoningMode });
    },
    onMutate: () => {
      startBuild();
    },
    onSuccess: (response) => {
      setBuildId(response.data.buildId);
    },
  });

  const submit = useCallback(
    async (spec: string, reasoningMode: ReasoningMode) => {
      await mutation.mutateAsync({ spec, reasoningMode });
    },
    [mutation],
  );

  return {
    submit,
    buildId,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}
