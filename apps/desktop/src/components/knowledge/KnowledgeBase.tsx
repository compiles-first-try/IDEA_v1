import { useState } from "react";

interface Doc {
  id: string;
  name: string;
  type: string;
  dateIngested: string;
  chunkCount: number;
  lastRetrieved: string;
}

interface SearchResult {
  content: string;
  score: number;
}

interface KnowledgeBaseProps {
  docs: Doc[];
  onDelete: (id: string) => void;
  onSearch: (query: string) => void;
  searchResults: SearchResult[];
}

export function KnowledgeBase({ docs, onDelete, onSearch, searchResults }: KnowledgeBaseProps) {
  const [query, setQuery] = useState("");

  const handleSearch = () => {
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <div className="space-y-6">
      {/* Document table */}
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left">
              <th className="p-2">Name</th>
              <th className="p-2">Type</th>
              <th className="p-2">Ingested</th>
              <th className="p-2 text-right">Chunks</th>
              <th className="p-2">Last Retrieved</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-b border-[var(--color-border)]">
                <td className="p-2 font-medium">{d.name}</td>
                <td className="p-2 text-[var(--color-text-secondary)]">{d.type}</td>
                <td className="p-2 text-[var(--color-text-secondary)]">{d.dateIngested}</td>
                <td className="p-2 text-right">{d.chunkCount}</td>
                <td className="p-2 text-[var(--color-text-secondary)]">{d.lastRetrieved}</td>
                <td className="p-2">
                  <button onClick={() => onDelete(d.id)} aria-label="Delete"
                    className="text-[10px] text-[var(--color-accent-red)] hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Semantic search */}
      <div>
        <div className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search knowledge base..."
            className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm placeholder:text-[var(--color-text-secondary)]" />
          <button onClick={handleSearch} className="rounded bg-[var(--color-accent-blue)] px-3 py-2 text-sm text-white">Search</button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map((r, i) => (
              <div key={i} className="rounded border border-[var(--color-border)] p-3">
                <div className="flex justify-between text-xs">
                  <span>{r.content}</span>
                  <span className="text-[var(--color-accent-blue)]">{r.score.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* V2 placeholder */}
      <div className="flex items-center justify-between rounded border border-[var(--color-border)] p-3 opacity-50">
        <span className="text-xs">Ontology Editor</span>
        <span className="text-[10px] text-[var(--color-accent-purple)]">Coming in V2</span>
      </div>
    </div>
  );
}
