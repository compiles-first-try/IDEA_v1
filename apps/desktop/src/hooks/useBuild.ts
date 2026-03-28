import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { governanceApi } from "@/api/governance.ts";
import { useSessionStore, type ReasoningMode, type BuildArtifacts } from "@/store/session.ts";
import { WS_URL } from "@/api/client.ts";

export function useBuild() {
  const [buildId, setBuildId] = useState<string | null>(null);
  const buildIdRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { startBuild, updateStage, completeBuild, setClarification, clearClarification } = useSessionStore();

  // Listen to WebSocket for stage events + clarification requests
  useEffect(() => {
    if (!buildId) return;
    buildIdRef.current = buildId;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type !== "audit_event" || !msg.data) return;

        const event = msg.data;
        // Kill switch events are global — don't filter by session_id
        const isGlobalEvent = event.action_type === "KILL_SWITCH_ACTIVATED";
        if (!isGlobalEvent && event.session_id !== buildIdRef.current) return;

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

        if (event.action_type === "CLARIFICATION_REQUESTED") {
          const questions = (event.outputs?.questions ?? []) as string[];
          if (questions.length > 0) {
            setClarification(questions);
          }
        }

        if (event.action_type === "CLARIFICATION_RESOLVED" || event.action_type === "CLARIFICATION_TIMEOUT") {
          clearClarification();
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

        // Kill switch activated — reset build state so UI is usable again
        if (event.action_type === "KILL_SWITCH_ACTIVATED") {
          useSessionStore.getState().reset();
        }
      } catch {
        /* ignore malformed messages */
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [buildId, updateStage, completeBuild, setClarification, clearClarification]);

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

  // Send clarification answers back via WebSocket
  const sendClarificationResponse = useCallback(
    (answers: Record<string, string>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && buildIdRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: "clarification_response",
            buildId: buildIdRef.current,
            payload: answers,
          }),
        );
        clearClarification();
      }
    },
    [clearClarification],
  );

  // Skip clarification — send empty answers so server times out / proceeds
  const skipClarification = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && buildIdRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "clarification_response",
          buildId: buildIdRef.current,
          payload: { _skipped: "true" },
        }),
      );
      clearClarification();
    }
  }, [clearClarification]);

  return {
    submit,
    buildId,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    sendClarificationResponse,
    skipClarification,
  };
}
