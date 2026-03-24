/**
 * Tests for the Property-Based Test Generator (fast-check).
 *
 * Verifies:
 * - Derives property tests from invariant specifications
 * - Supports common invariants: idempotency, commutativity, associativity, range bounds
 * - Generates runnable fast-check property test code
 * - Detects property violations on buggy functions
 * - Passes properties on correct functions
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

describe("Property-Based Test Generator", () => {
  let pbt: typeof import("../src/mutation/index.js");

  it("should load module", async () => {
    pbt = await import("../src/mutation/index.js");
    expect(pbt).toBeDefined();
  });

  describe("Built-in property checkers", () => {
    it("should verify idempotency: f(f(x)) === f(x)", () => {
      // Math.abs is idempotent
      const result = pbt.checkIdempotency(
        (x: number) => Math.abs(x),
        fc.integer({ min: -1000, max: 1000 })
      );
      expect(result.passed).toBe(true);
    });

    it("should detect non-idempotent function", () => {
      // x + 1 is NOT idempotent: f(f(x)) = x+2 !== x+1
      const result = pbt.checkIdempotency(
        (x: number) => x + 1,
        fc.integer({ min: -100, max: 100 })
      );
      expect(result.passed).toBe(false);
      expect(result.counterExample).toBeDefined();
    });

    it("should verify commutativity: f(a,b) === f(b,a)", () => {
      const result = pbt.checkCommutativity(
        (a: number, b: number) => a + b,
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: -1000, max: 1000 })
      );
      expect(result.passed).toBe(true);
    });

    it("should detect non-commutative function", () => {
      const result = pbt.checkCommutativity(
        (a: number, b: number) => a - b,
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 })
      );
      expect(result.passed).toBe(false);
    });

    it("should verify range bounds: min <= f(x) <= max", () => {
      const clamp = (x: number) => Math.max(0, Math.min(100, x));
      const result = pbt.checkRangeBound(
        clamp,
        fc.integer({ min: -1000, max: 1000 }),
        0,
        100
      );
      expect(result.passed).toBe(true);
    });

    it("should detect out-of-range output", () => {
      // This function can go negative
      const result = pbt.checkRangeBound(
        (x: number) => x,
        fc.integer({ min: -100, max: 100 }),
        0,
        100
      );
      expect(result.passed).toBe(false);
    });
  });

  describe("Property test code generation", () => {
    it("should generate runnable fast-check property test code", () => {
      const code = pbt.generatePropertyTestCode({
        functionName: "clamp",
        properties: [
          { type: "range", min: 0, max: 100, description: "output is always in [0, 100]" },
          { type: "idempotency", description: "clamp(clamp(x)) === clamp(x)" },
        ],
      });

      expect(code).toContain("fc.property");
      expect(code).toContain("clamp");
      expect(code).toContain("fast-check");
    });
  });
});
