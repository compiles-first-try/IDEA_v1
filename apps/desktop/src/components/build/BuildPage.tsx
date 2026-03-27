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
  const [leftPct, setLeftPct] = useState(40);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (spec: string, mode: ReasoningMode) => {
    try {
      await build.submit(spec, mode);
    } catch {
      // error state available via build.isError
    }
  };

  const onMouseDown = useCallback(() => {
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.max(20, Math.min(70, pct)));
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
    <div ref={containerRef} className="flex h-full">
      {/* Left panel — spec input */}
      <div data-testid="build-left" className="flex flex-col" style={{ width: `${leftPct}%` }}>
        <SpecInputFull onSubmit={handleSubmit} busy={busy} />
        {build.isError && (
          <p className="mt-2 text-xs text-[var(--color-accent-red)]">
            Failed to submit build. Check that the governance API is running.
          </p>
        )}
      </div>

      {/* Draggable divider */}
      <div
        onMouseDown={onMouseDown}
        className="flex w-2 shrink-0 cursor-col-resize items-center justify-center hover:bg-[var(--color-accent-blue)]/20"
        title="Drag to resize"
      >
        <div className="h-8 w-0.5 rounded bg-[var(--color-border)]" />
      </div>

      {/* Right panel — pipeline + artifacts */}
      <div data-testid="build-right" className="flex flex-1 flex-col gap-4">
        <PipelineView stages={stages} />
        <div className="flex-1 min-h-0">
          <ArtifactView artifacts={artifacts} />
        </div>
      </div>
    </div>
  );
}
