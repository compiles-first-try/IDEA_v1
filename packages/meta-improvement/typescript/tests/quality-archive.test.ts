/**
 * Tests for the Quality-Diversity Archive.
 *
 * MAP-Elites inspired: stores agent configurations indexed by
 * behavioral descriptors, preserving diverse stepping-stone innovations
 * even if they're not globally top-scoring.
 *
 * Verifies:
 * - Stores configurations with scores and behavioral descriptors
 * - Retrieves the best configuration per niche
 * - Preserves diversity — doesn't collapse to single solution
 * - Tracks lineage (parent → child)
 * - Returns the global best across all niches
 * - Evicts only when a better config in the same niche arrives
 * - Provides archive statistics
 */
import { describe, it, expect } from "vitest";

describe("Quality-Diversity Archive", () => {
  let archive: typeof import("../src/quality-archive/index.js");

  it("should load module", async () => {
    archive = await import("../src/quality-archive/index.js");
    expect(archive).toBeDefined();
  });

  it("should add and retrieve a configuration", () => {
    const qa = archive.createQualityArchive();

    qa.add({
      id: "config-1",
      generation: 1,
      niche: "code-generation",
      score: 0.75,
      config: { prompt: "Generate TypeScript code", model: "qwen2.5-coder:14b" },
      parentId: null,
    });

    const best = qa.getBest("code-generation");
    expect(best).toBeDefined();
    expect(best!.id).toBe("config-1");
    expect(best!.score).toBe(0.75);
  });

  it("should replace a config in a niche only if score improves", () => {
    const qa = archive.createQualityArchive();

    qa.add({ id: "a", generation: 1, niche: "testing", score: 0.6, config: {}, parentId: null });
    qa.add({ id: "b", generation: 2, niche: "testing", score: 0.8, config: {}, parentId: "a" });
    qa.add({ id: "c", generation: 3, niche: "testing", score: 0.7, config: {}, parentId: "b" });

    const best = qa.getBest("testing");
    expect(best!.id).toBe("b"); // Score 0.8 is still highest
    expect(best!.score).toBe(0.8);
  });

  it("should preserve diversity across niches", () => {
    const qa = archive.createQualityArchive();

    qa.add({ id: "gen-1", generation: 1, niche: "code-generation", score: 0.9, config: {}, parentId: null });
    qa.add({ id: "test-1", generation: 1, niche: "test-generation", score: 0.7, config: {}, parentId: null });
    qa.add({ id: "repair-1", generation: 1, niche: "program-repair", score: 0.6, config: {}, parentId: null });

    const niches = qa.listNiches();
    expect(niches).toHaveLength(3);
    expect(niches.sort()).toEqual(["code-generation", "program-repair", "test-generation"]);
  });

  it("should return the global best across all niches", () => {
    const qa = archive.createQualityArchive();

    qa.add({ id: "a", generation: 1, niche: "n1", score: 0.6, config: {}, parentId: null });
    qa.add({ id: "b", generation: 1, niche: "n2", score: 0.9, config: {}, parentId: null });
    qa.add({ id: "c", generation: 1, niche: "n3", score: 0.75, config: {}, parentId: null });

    const global = qa.getGlobalBest();
    expect(global).toBeDefined();
    expect(global!.id).toBe("b");
    expect(global!.score).toBe(0.9);
  });

  it("should track lineage via parentId", () => {
    const qa = archive.createQualityArchive();

    qa.add({ id: "gen1", generation: 1, niche: "x", score: 0.5, config: {}, parentId: null });
    qa.add({ id: "gen2", generation: 2, niche: "x", score: 0.7, config: {}, parentId: "gen1" });
    qa.add({ id: "gen3", generation: 3, niche: "x", score: 0.9, config: {}, parentId: "gen2" });

    const lineage = qa.getLineage("gen3");
    expect(lineage).toEqual(["gen1", "gen2", "gen3"]);
  });

  it("should provide archive statistics", () => {
    const qa = archive.createQualityArchive();

    qa.add({ id: "a", generation: 1, niche: "n1", score: 0.6, config: {}, parentId: null });
    qa.add({ id: "b", generation: 2, niche: "n1", score: 0.8, config: {}, parentId: "a" });
    qa.add({ id: "c", generation: 1, niche: "n2", score: 0.7, config: {}, parentId: null });

    const stats = qa.getStats();
    expect(stats.totalNiches).toBe(2);
    expect(stats.totalEntries).toBe(3);
    expect(stats.avgScore).toBeCloseTo(0.7, 1);
    expect(stats.bestScore).toBe(0.8);
  });
});
