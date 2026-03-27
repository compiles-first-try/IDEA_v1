import { useState, useRef, useCallback } from "react";
import type { ReasoningMode } from "@/store/session.ts";

interface SpecInputFullProps {
  onSubmit: (spec: string, mode: ReasoningMode) => void;
  busy: boolean;
}

const MODES: { key: ReasoningMode; label: string; hint: string }[] = [
  { key: "sequential", label: "Sequential", hint: "Steps run one after another, each building on the last" },
  { key: "feynman", label: "Feynman", hint: "Explain-then-generate: simplify the spec before coding" },
  { key: "parallel-dag", label: "Parallel DAG", hint: "Independent steps run in parallel where possible" },
];

const ACCEPTED_EXTENSIONS = [".md", ".txt", ".json", ".yaml", ".yml"];

export function SpecInputFull({ onSubmit, busy }: SpecInputFullProps) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<ReasoningMode>("sequential");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (value.trim() && !busy) {
      onSubmit(value.trim(), mode);
    }
  };

  const loadFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") {
        setValue(text);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  }, [loadFile]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div
        className={`relative flex-1 ${dragOver ? "ring-2 ring-[var(--color-accent-blue)] rounded" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <textarea
          role="textbox"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Describe the software you want to build, or drop a spec file here..."
          disabled={busy}
          className="h-full w-full resize-none rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]"
        />
        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center rounded bg-[var(--color-accent-blue)]/10">
            <span className="text-sm font-medium text-[var(--color-accent-blue)]">Drop file to load spec</span>
          </div>
        )}
      </div>

      {/* File picker + reasoning mode */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="rounded border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] disabled:opacity-40"
        >
          Load file
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="mx-1 h-4 w-px bg-[var(--color-border)]" />

        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            title={m.hint}
            className={`rounded px-2.5 py-1 text-xs ${
              mode === m.key
                ? "bg-[var(--color-accent-blue)] text-white"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!value.trim() || busy}
        className="self-end rounded bg-[var(--color-accent-blue)] px-6 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
        aria-label="Build"
      >
        {busy ? "Building..." : "Build"}
      </button>
    </div>
  );
}
