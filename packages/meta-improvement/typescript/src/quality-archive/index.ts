/**
 * Quality-Diversity Archive (MAP-Elites inspired).
 *
 * Stores agent configurations indexed by behavioral niche descriptors.
 * Preserves diverse stepping-stone innovations — a config that's not
 * globally best may be the best in its niche and serve as a stepping
 * stone for future improvements.
 */

export interface ArchiveEntry {
  id: string;
  generation: number;
  niche: string;
  score: number;
  config: Record<string, unknown>;
  parentId: string | null;
}

export interface ArchiveStats {
  totalNiches: number;
  totalEntries: number;
  avgScore: number;
  bestScore: number;
}

export interface QualityArchive {
  add: (entry: ArchiveEntry) => void;
  getBest: (niche: string) => ArchiveEntry | null;
  getGlobalBest: () => ArchiveEntry | null;
  listNiches: () => string[];
  getLineage: (id: string) => string[];
  getStats: () => ArchiveStats;
}

/**
 * Create an in-memory quality-diversity archive.
 * Each niche holds the best-scoring configuration.
 * All entries are preserved for lineage tracking.
 */
export function createQualityArchive(): QualityArchive {
  // Best config per niche
  const niches = new Map<string, ArchiveEntry>();
  // All entries for lineage tracking
  const allEntries = new Map<string, ArchiveEntry>();

  function add(entry: ArchiveEntry): void {
    allEntries.set(entry.id, entry);

    const current = niches.get(entry.niche);
    if (!current || entry.score > current.score) {
      niches.set(entry.niche, entry);
    }
  }

  function getBest(niche: string): ArchiveEntry | null {
    return niches.get(niche) ?? null;
  }

  function getGlobalBest(): ArchiveEntry | null {
    let best: ArchiveEntry | null = null;
    for (const entry of niches.values()) {
      if (!best || entry.score > best.score) {
        best = entry;
      }
    }
    return best;
  }

  function listNiches(): string[] {
    return Array.from(niches.keys());
  }

  function getLineage(id: string): string[] {
    const visited = new Set<string>();
    let current = allEntries.get(id);

    // Walk up the parent chain
    const ancestors: string[] = [];
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      ancestors.push(current.id);
      current = current.parentId ? allEntries.get(current.parentId) ?? undefined : undefined;
    }

    // Reverse to get root-first order
    return ancestors.reverse();
  }

  function getStats(): ArchiveStats {
    const entries = Array.from(allEntries.values());
    const totalEntries = entries.length;
    const totalNiches = niches.size;
    const avgScore = totalEntries > 0
      ? entries.reduce((sum, e) => sum + e.score, 0) / totalEntries
      : 0;
    const bestScore = totalEntries > 0
      ? Math.max(...entries.map((e) => e.score))
      : 0;

    return { totalNiches, totalEntries, avgScore, bestScore };
  }

  return { add, getBest, getGlobalBest, listNiches, getLineage, getStats };
}
