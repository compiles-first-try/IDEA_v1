import { useState } from "react";

interface HistoryEntry {
  generation: number;
  score: number;
  changes: string;
  parentId: string | null;
  timestamp: string;
}

interface QualityArchiveProps {
  history: HistoryEntry[];
}

export function QualityArchive({ history }: QualityArchiveProps) {
  const [selectedGen, setSelectedGen] = useState<number | null>(null);
  const selected = history.find((h) => h.generation === selectedGen);

  return (
    <div className="space-y-4">
      {/* Chart area — Recharts line chart placeholder (Recharts needs a real DOM width, so we use a testid container) */}
      <div data-testid="quality-chart" className="h-[200px] rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <div className="flex h-full items-end gap-1">
          {history.map((h) => (
            <div key={h.generation} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-[var(--color-accent-blue)]"
                style={{ height: `${h.score * 150}px` }}
              />
              <span className="text-[9px] text-[var(--color-text-secondary)]">{h.score.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* History table */}
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left">
              <th className="p-2">Generation</th>
              <th className="p-2">Score</th>
              <th className="p-2">Changes</th>
              <th className="p-2">Lineage</th>
              <th className="p-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.generation} onClick={() => setSelectedGen(h.generation)}
                className="cursor-pointer border-b border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)]">
                <td className="p-2 font-medium">Gen {h.generation}</td>
                <td className="p-2">{h.score.toFixed(2)}</td>
                <td className="p-2">{h.changes}</td>
                <td className="p-2 text-[var(--color-text-secondary)]">{h.parentId ?? "—"}</td>
                <td className="p-2 text-[var(--color-text-secondary)]">{new Date(h.timestamp).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selected && (
        <div data-testid="archive-detail" className="rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 text-xs">
          <h4 className="mb-2 font-semibold">Generation {selected.generation} Detail</h4>
          <div className="space-y-1">
            <div><span className="text-[var(--color-text-secondary)]">Score:</span> {selected.score.toFixed(2)}</div>
            <div><span className="text-[var(--color-text-secondary)]">Changes:</span> {selected.changes}</div>
            <div><span className="text-[var(--color-text-secondary)]">Parent:</span> {selected.parentId ?? "None (initial)"}</div>
            <div><span className="text-[var(--color-text-secondary)]">Date:</span> {selected.timestamp}</div>
          </div>
        </div>
      )}
    </div>
  );
}
