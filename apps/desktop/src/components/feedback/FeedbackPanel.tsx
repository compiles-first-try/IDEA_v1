import { useState } from "react";

interface Artifact {
  id: string;
  type: string;
  name: string;
  createdAt: string;
  qualityScore: number;
  userRating: string | null;
  validationStatus: string | null;
}

interface FeedbackSummary {
  total: number;
  accepted: number;
  acceptedWithNote: number;
  pendingClarification: number;
  overridden: number;
}

interface ValidationConflict {
  signal: string;
  evidence: string;
}

interface ValidationResponse {
  artifactId: string;
  conflicts: ValidationConflict[];
  status: string;
}

type Tag = "CORRECT" | "INCORRECT" | "PARTIAL" | "EXCELLENT";

interface FeedbackPanelProps {
  artifacts: Artifact[];
  summary: FeedbackSummary;
  onSubmit: (data: { artifactId: string; rating: "up" | "down"; tag: Tag; note: string }) => void;
  onConfirm: (artifactId: string, action: "confirm" | "update" | "dismiss") => void;
  validationResponse?: ValidationResponse | null;
}

export function FeedbackPanel({ artifacts, summary, onSubmit, onConfirm, validationResponse }: FeedbackPanelProps) {
  const [ratingFor, setRatingFor] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<Tag>("CORRECT");
  const [note, setNote] = useState("");
  const TAGS: Tag[] = ["CORRECT", "INCORRECT", "PARTIAL", "EXCELLENT"];

  const handleSubmit = (artifactId: string, rating: "up" | "down") => {
    onSubmit({ artifactId, rating, tag: selectedTag, note });
    setRatingFor(null);
    setNote("");
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3 text-center text-xs">
        <div className="rounded border border-[var(--color-border)] p-2">
          <div className="text-lg font-semibold">{summary.total}</div>
          <div className="text-[var(--color-text-secondary)]">Total submitted</div>
        </div>
        <div className="rounded border border-[var(--color-border)] p-2">
          <div className="text-lg font-semibold text-[var(--color-accent-green)]">{summary.accepted}</div>
          <div className="text-[var(--color-text-secondary)]">Accepted</div>
        </div>
        <div className="rounded border border-[var(--color-border)] p-2">
          <div className="text-lg font-semibold text-[var(--color-accent-amber)]">{summary.pendingClarification}</div>
          <div className="text-[var(--color-text-secondary)]">Pending</div>
        </div>
        <div className="rounded border border-[var(--color-border)] p-2">
          <div className="text-lg font-semibold text-[var(--color-accent-purple)]">{summary.overridden}</div>
          <div className="text-[var(--color-text-secondary)]">Overridden</div>
        </div>
      </div>

      {/* Validation response panel */}
      {validationResponse && (
        <div className="rounded-lg border border-[var(--color-accent-amber)] bg-[var(--color-bg-elevated)] p-4">
          <h4 className="mb-2 text-xs font-semibold">Validation found a conflict</h4>
          {validationResponse.conflicts.map((c, i) => (
            <div key={i} className="mb-2 text-xs text-[var(--color-text-secondary)]">
              <span className="font-medium">{c.signal}:</span> {c.evidence}
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={() => onConfirm(validationResponse.artifactId, "confirm")} aria-label="Confirm my rating"
              className="rounded bg-[var(--color-accent-blue)] px-3 py-1.5 text-xs text-white">Confirm my rating anyway</button>
            <button onClick={() => onConfirm(validationResponse.artifactId, "update")} aria-label="Update my rating"
              className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs">Update my rating</button>
            <button onClick={() => onConfirm(validationResponse.artifactId, "dismiss")} aria-label="Dismiss"
              className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]">Dismiss</button>
          </div>
        </div>
      )}

      {/* Artifacts list */}
      <div className="space-y-2">
        {artifacts.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded border border-[var(--color-border)] p-3">
            <span className="rounded bg-[var(--color-bg-elevated)] px-1.5 py-0.5 text-[10px]">{a.type}</span>
            <span className="flex-1 text-sm font-medium">{a.name}</span>
            <span className="text-xs text-[var(--color-text-secondary)]">{a.qualityScore.toFixed(2)}</span>
            {a.validationStatus && (
              <span className={`text-[10px] ${a.validationStatus === "ACCEPTED" ? "text-[var(--color-accent-green)]" : "text-[var(--color-accent-amber)]"}`}>
                {a.validationStatus}
              </span>
            )}
            <div className="flex gap-1">
              <button aria-label="Thumbs up" onClick={() => { setRatingFor(a.id); handleSubmit(a.id, "up"); }}
                className="rounded border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-elevated)]">👍</button>
              <button aria-label="Thumbs down" onClick={() => { setRatingFor(a.id); handleSubmit(a.id, "down"); }}
                className="rounded border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-bg-elevated)]">👎</button>
            </div>
          </div>
        ))}
      </div>

      {/* Tag selector (shown when rating) */}
      {ratingFor && (
        <div className="flex gap-2">
          {TAGS.map((t) => (
            <button key={t} onClick={() => setSelectedTag(t)}
              className={`rounded px-2 py-1 text-xs ${selectedTag === t ? "bg-[var(--color-accent-blue)] text-white" : "border border-[var(--color-border)]"}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      <p className="text-[10px] text-[var(--color-text-secondary)]">This data will be used in the next improvement cycle.</p>
    </div>
  );
}
