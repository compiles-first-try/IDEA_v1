import { useState, useCallback, useRef } from "react";
import { useSessionStore } from "@/store/session.ts";
import { useBuild } from "@/hooks/useBuild.ts";
import { SpecInputFull } from "./SpecInputFull.tsx";
import { PipelineView } from "./PipelineView.tsx";
import { ArtifactView } from "./ArtifactView.tsx";
import type { ReasoningMode } from "@/store/session.ts";

export function BuildPage() {
  const { busy, stages, artifacts } = useSessionStore();
  const build = useBuild();
  const [topPct, setTopPct] = useState(40);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasActivity = busy || stages.some((s) => s.status !== "pending") || artifacts !== null;

  const handleSubmit = async (spec: string, mode: ReasoningMode) => {
    try {
      await build.submit(spec, mode);
    } catch {
      // error state available via build.isError
    }
  };

  const onMouseDown = useCallback(() => {
    dragging.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientY - rect.top) / rect.height) * 100;
      setTopPct(Math.max(20, Math.min(70, pct)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  return (
    <div ref={containerRef} className="flex h-full flex-col">
      {/* Top: Spec input — full width, primary interface */}
      <div data-testid="build-left" className="flex flex-col" style={{ height: hasActivity ? `${topPct}%` : "100%" }}>
        <SpecInputFull onSubmit={handleSubmit} busy={busy} />
        {build.isError && (
          <p className="mt-2 text-xs text-[var(--color-accent-red)]">
            Failed to submit build. Check that the governance API is running.
          </p>
        )}
      </div>

      {/* Draggable horizontal divider — only shown when pipeline has activity */}
      {hasActivity && (
        <>
          <div
            onMouseDown={onMouseDown}
            className="flex h-2 shrink-0 cursor-row-resize items-center justify-center hover:bg-[var(--color-accent-blue)]/20"
            title="Drag to resize"
          >
            <div className="h-0.5 w-8 rounded bg-[var(--color-border)]" />
          </div>

          {/* Bottom: Pipeline flow + Artifacts — side by side */}
          <div data-testid="build-right" className="flex flex-1 gap-4 min-h-0 overflow-auto">
            <div className="w-[340px] shrink-0 overflow-y-auto">
              <PipelineView stages={stages} />
            </div>
            <div className="flex-1 min-w-0">
              <ArtifactView artifacts={artifacts} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
