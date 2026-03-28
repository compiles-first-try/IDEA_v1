import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { governanceApi } from "@/api/governance.ts";
import { useSessionStore, type ReasoningMode, type BuildArtifacts } from "@/store/session.ts";
import { WS_URL } from "@/api/client.ts";

export function useBuild() {
  const [buildId, setBuildId] = useState<string | null>(null);
  const buildIdRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingEventsRef = useRef<Array<Record<string, unknown>>>([]);
  const { startBuild, updateStage, completeBuild, setClarification, clearClarification } = useSessionStore();

  // Process a single WebSocket event
  const processEvent = useCallback((event: Record<string, unknown>) => {
    const currentBuildId = buildIdRef.current;
    const isGlobalEvent = event.action_type === "KILL_SWITCH_ACTIVATED";

    if (!isGlobalEvent && String(event.session_id ?? "") !== currentBuildId) return;

    const stageId = (event.inputs as Record<string, unknown> | undefined)?.stageId as string | undefined;

    if (event.action_type === "STAGE_STARTED" && stageId) {
      updateStage(stageId, {
        status: "running",
        modelUsed: (event.model_used as string) ?? null,
      });
    }

    if (event.action_type === "STAGE_COMPLETED" && stageId) {
      updateStage(stageId, {
        status: "passed",
        durationMs: (event.duration_ms as number) ?? null,
        modelUsed: (event.model_used as string) ?? null,
      });
    }

    if (event.action_type === "CLARIFICATION_REQUESTED") {
      const outputs = (event.outputs ?? {}) as Record<string, unknown>;
      const questions = (outputs.questions ?? []) as string[];
      if (questions.length > 0) {
        setClarification(questions);
      }
    }

    if (event.action_type === "CLARIFICATION_RESOLVED" || event.action_type === "CLARIFICATION_TIMEOUT") {
      clearClarification();
    }

    if (event.action_type === "BUILD_COMPLETED") {
      const outputs = (event.outputs ?? {}) as Record<string, unknown>;
      const artifacts: BuildArtifacts = {
        generatedCode: (outputs.generatedCode as string) ?? "",
        generatedTests: (outputs.generatedTests as string) ?? "",
        qualityGates: (outputs.qualityGates as BuildArtifacts["qualityGates"]) ?? [],
        auditTrail: [],
      };
      completeBuild(artifacts);
    }

    if (event.action_type === "KILL_SWITCH_ACTIVATED") {
      useSessionStore.getState().reset();
    }
  }, [updateStage, completeBuild, setClarification, clearClarification]);

  // Connect WebSocket on mount — stays connected across builds
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type !== "audit_event" || !msg.data) return;

        const event = msg.data as Record<string, unknown>;

        if (buildIdRef.current) {
          // We have a buildId — process immediately
          processEvent(event);
        } else {
          // No buildId yet — queue the event for replay
          pendingEventsRef.current.push(event);
        }
      } catch {
        /* ignore malformed messages */
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [processEvent]);

  // When buildId is set, replay any queued events that match
  useEffect(() => {
    if (!buildId) return;
    buildIdRef.current = buildId;

    // Replay pending events that were received before buildId was set
    const pending = pendingEventsRef.current;
    pendingEventsRef.current = [];
    for (const event of pending) {
      processEvent(event);
    }
  }, [buildId, processEvent]);

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
      pendingEventsRef.current = [];
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
