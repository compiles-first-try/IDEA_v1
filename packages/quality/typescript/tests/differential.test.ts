/**
 * Tests for the Differential Testing Engine (N-version comparison).
 *
 * Verifies:
 * - Runs N function versions against the same inputs
 * - Detects unanimous agreement (all versions same output)
 * - Detects divergence (one or more versions disagree)
 * - Reports which versions diverge and on which inputs
 * - Majority voting identifies likely-correct output
 * - Handles runtime errors in individual versions gracefully
 */
import { describe, it, expect } from "vitest";

describe("Differential Testing Engine", () => {
  let differential: typeof import("../src/differential/index.js");

  it("should load module", async () => {
    differential = await import("../src/differential/index.js");
    expect(differential).toBeDefined();
  });

  it("should detect unanimous agreement across N versions", () => {
    const versions = [
      { name: "v1", fn: (x: number) => x * 2 },
      { name: "v2", fn: (x: number) => x + x },
      { name: "v3", fn: (x: number) => 2 * x },
    ];

    const inputs = [0, 1, 5, -3, 100];
    const result = differential.runDifferentialTest(versions, inputs);

    expect(result.unanimous).toBe(true);
    expect(result.divergences).toHaveLength(0);
    expect(result.totalInputs).toBe(5);
    expect(result.totalVersions).toBe(3);
  });

  it("should detect divergence when one version is buggy", () => {
    const versions = [
      { name: "correct-v1", fn: (x: number) => x * 2 },
      { name: "correct-v2", fn: (x: number) => x + x },
      { name: "buggy-v3", fn: (x: number) => x * 3 }, // Bug!
    ];

    const inputs = [1, 5, 10];
    const result = differential.runDifferentialTest(versions, inputs);

    expect(result.unanimous).toBe(false);
    expect(result.divergences.length).toBeGreaterThan(0);
    // Every non-zero input should diverge
    expect(result.divergences.every(d => d.input !== 0)).toBe(true);
  });

  it("should use majority voting to identify likely-correct output", () => {
    const versions = [
      { name: "v1", fn: (x: number) => x * 2 },
      { name: "v2", fn: (x: number) => x + x },
      { name: "buggy", fn: (x: number) => x * 3 },
    ];

    const inputs = [5];
    const result = differential.runDifferentialTest(versions, inputs);

    expect(result.divergences).toHaveLength(1);
    const div = result.divergences[0];
    expect(div.majorityOutput).toBe(10); // 2 versions agree on 10
    expect(div.outlierVersions).toContain("buggy");
  });

  it("should handle runtime errors in individual versions", () => {
    const versions = [
      { name: "safe", fn: (x: number) => x * 2 },
      {
        name: "crashes",
        fn: (x: number) => {
          if (x === 0) throw new Error("div by zero");
          return x * 2;
        },
      },
      { name: "safe2", fn: (x: number) => 2 * x },
    ];

    const inputs = [0, 5];
    const result = differential.runDifferentialTest(versions, inputs);

    // Input 0 should show divergence (crash vs normal)
    const zeroDiv = result.divergences.find(d => d.input === 0);
    expect(zeroDiv).toBeDefined();
    expect(zeroDiv!.errors.length).toBeGreaterThan(0);
  });

  it("should work with string outputs", () => {
    const versions = [
      { name: "v1", fn: (s: string) => s.toUpperCase() },
      { name: "v2", fn: (s: string) => s.split("").map(c => c.toUpperCase()).join("") },
    ];

    const inputs = ["hello", "World", ""];
    const result = differential.runDifferentialTest(versions, inputs);

    expect(result.unanimous).toBe(true);
  });
});
