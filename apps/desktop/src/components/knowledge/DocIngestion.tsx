import { useState } from "react";

interface DocIngestionProps {
  onIngest: (data: { url: string; tags: string }) => void;
  processingStatus?: string | null;
}

export function DocIngestion({ onIngest, processingStatus }: DocIngestionProps) {
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");

  const handleIngest = () => {
    if (url.trim()) {
      onIngest({ url: url.trim(), tags: tags.trim() });
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm text-[var(--color-text-secondary)]">
        Drop files here (PDF, Markdown, plain text, OpenAPI YAML/JSON)
      </div>

      {/* URL input */}
      <input value={url} onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a URL to ingest..."
        className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm placeholder:text-[var(--color-text-secondary)]" />

      {/* Tags */}
      <input value={tags} onChange={(e) => setTags(e.target.value)}
        placeholder="Tags (comma-separated)"
        className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm placeholder:text-[var(--color-text-secondary)]" />

      <button onClick={handleIngest} disabled={!url.trim()} aria-label="Ingest"
        className="rounded bg-[var(--color-accent-blue)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40">
        Ingest
      </button>

      {/* Processing status */}
      {processingStatus && (
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--color-accent-amber)]" />
          <span className="text-[var(--color-text-secondary)]">Processing: {processingStatus}</span>
        </div>
      )}
    </div>
  );
}
