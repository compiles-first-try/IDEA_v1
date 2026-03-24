/**
 * Tests for the Metamorphic Test Generator.
 *
 * Metamorphic testing creates relations between inputs/outputs
 * where the exact expected output is unknown, but the RELATIONSHIP
 * between transformed inputs and outputs must hold.
 *
 * Verifies:
 * - Generates metamorphic relations from function signatures
 * - Applies source input transformations
 * - Validates that relations hold on known-correct code
 * - Detects violations on buggy code
 * - Supports common relation types (additive, multiplicative, permutation-invariant, negation)
 */
import { describe, it, expect } from "vitest";

describe("Metamorphic Test Generator", () => {
  let metamorphic: typeof import("../src/metamorphic/index.js");

  it("should load module", async () => {
    metamorphic = await import("../src/metamorphic/index.js");
    expect(metamorphic).toBeDefined();
  });

  describe("Built-in relation types", () => {
    it("should provide an additive relation", () => {
      // f(x + k) should relate to f(x) in a predictable way
      const relation = metamorphic.additiveRelation<number, number>({
        transform: (x) => x + 10,
        verify: (sourceOut, followOut, sourceIn, followIn) => {
          // For a linear function f(x)=2x: f(x+10) = f(x)+20
          return Math.abs(followOut - (sourceOut + 20)) < 0.001;
        },
        name: "additive-shift",
      });

      expect(relation.name).toBe("additive-shift");
      expect(relation.transform(5)).toBe(15);
      // f(5)=10, f(15)=30, verify: 30 === 10+20
      expect(relation.verify(10, 30, 5, 15)).toBe(true);
      expect(relation.verify(10, 25, 5, 15)).toBe(false);
    });

    it("should provide a permutation-invariant relation", () => {
      // For sorting: sort(permute(arr)) === sort(arr)
      const relation = metamorphic.permutationInvariantRelation<number[], number[]>({
        transform: (arr) => [...arr].reverse(),
        verify: (sourceOut, followOut) =>
          JSON.stringify(sourceOut) === JSON.stringify(followOut),
        name: "reverse-invariant",
      });

      expect(relation.name).toBe("reverse-invariant");
      const sorted = [1, 2, 3];
      expect(relation.verify(sorted, sorted, [3, 2, 1], [1, 2, 3])).toBe(true);
    });

    it("should provide a negation relation", () => {
      // For abs: abs(-x) === abs(x)
      const relation = metamorphic.negationRelation<number, number>({
        transform: (x) => -x,
        verify: (sourceOut, followOut) => sourceOut === followOut,
        name: "abs-negation",
      });

      expect(relation.verify(5, 5, 3, -3)).toBe(true);
      expect(relation.verify(5, 3, 3, -3)).toBe(false);
    });
  });

  describe("Metamorphic test runner", () => {
    it("should detect a correct function passes all relations", () => {
      // Test abs function
      const absFn = (x: number): number => Math.abs(x);

      const relations = [
        metamorphic.negationRelation<number, number>({
          transform: (x) => -x,
          verify: (srcOut, fupOut) => srcOut === fupOut,
          name: "abs-negation",
        }),
      ];

      const inputs = [-5, -1, 0, 1, 5, 100];
      const result = metamorphic.runMetamorphicTests(absFn, inputs, relations);

      expect(result.totalRelations).toBe(1);
      expect(result.totalInputs).toBe(6);
      expect(result.violations).toHaveLength(0);
      expect(result.passed).toBe(true);
    });

    it("should detect a buggy function violates relations", () => {
      // Buggy abs that doesn't handle negatives
      const buggyAbs = (x: number): number => x; // Bug: no abs

      const relations = [
        metamorphic.negationRelation<number, number>({
          transform: (x) => -x,
          verify: (srcOut, fupOut) => srcOut === fupOut,
          name: "abs-negation",
        }),
      ];

      const inputs = [-5, -1, 1, 5];
      const result = metamorphic.runMetamorphicTests(buggyAbs, inputs, relations);

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].relationName).toBe("abs-negation");
    });

    it("should run multiple relations", () => {
      const sortFn = (arr: number[]): number[] => [...arr].sort((a, b) => a - b);

      const relations = [
        metamorphic.permutationInvariantRelation<number[], number[]>({
          transform: (arr) => [...arr].reverse(),
          verify: (srcOut, fupOut) => JSON.stringify(srcOut) === JSON.stringify(fupOut),
          name: "reverse-invariant",
        }),
        metamorphic.additiveRelation<number[], number[]>({
          transform: (arr) => arr.map((x) => x + 100),
          verify: (srcOut, fupOut) =>
            srcOut.every((v, i) => fupOut[i] === v + 100),
          name: "shift-invariant",
        }),
      ];

      const inputs = [[3, 1, 2], [5, 4, 3, 2, 1], [1]];
      const result = metamorphic.runMetamorphicTests(sortFn, inputs, relations);

      expect(result.totalRelations).toBe(2);
      expect(result.passed).toBe(true);
    });
  });
});
