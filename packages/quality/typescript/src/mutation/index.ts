/**
 * Property-Based Test Generator using fast-check.
 *
 * Derives property tests from invariant specifications rather than
 * hand-written examples. Supports common properties like idempotency,
 * commutativity, associativity, and range bounds.
 */
import * as fc from "fast-check";

export interface PropertyResult {
  passed: boolean;
  counterExample?: unknown;
  numRuns: number;
  error?: string;
}

/**
 * Check idempotency: f(f(x)) === f(x)
 */
export function checkIdempotency<T>(
  fn: (x: T) => T,
  arbitrary: fc.Arbitrary<T>,
  numRuns = 100
): PropertyResult {
  try {
    fc.assert(
      fc.property(arbitrary, (x) => {
        const once = fn(x);
        const twice = fn(once);
        return JSON.stringify(once) === JSON.stringify(twice);
      }),
      { numRuns }
    );
    return { passed: true, numRuns };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const counterMatch = message.match(/Counterexample: \[([^\]]+)\]/);
    return {
      passed: false,
      counterExample: counterMatch ? counterMatch[1] : undefined,
      numRuns,
      error: message,
    };
  }
}

/**
 * Check commutativity: f(a, b) === f(b, a)
 */
export function checkCommutativity<T, R>(
  fn: (a: T, b: T) => R,
  arbA: fc.Arbitrary<T>,
  arbB: fc.Arbitrary<T>,
  numRuns = 100
): PropertyResult {
  try {
    fc.assert(
      fc.property(arbA, arbB, (a, b) => {
        return JSON.stringify(fn(a, b)) === JSON.stringify(fn(b, a));
      }),
      { numRuns }
    );
    return { passed: true, numRuns };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { passed: false, numRuns, error: message, counterExample: message };
  }
}

/**
 * Check range bounds: min <= f(x) <= max for all x
 */
export function checkRangeBound<T>(
  fn: (x: T) => number,
  arbitrary: fc.Arbitrary<T>,
  min: number,
  max: number,
  numRuns = 100
): PropertyResult {
  try {
    fc.assert(
      fc.property(arbitrary, (x) => {
        const result = fn(x);
        return result >= min && result <= max;
      }),
      { numRuns }
    );
    return { passed: true, numRuns };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { passed: false, numRuns, error: message, counterExample: message };
  }
}

export interface PropertySpec {
  type: "idempotency" | "commutativity" | "range" | "associativity";
  description: string;
  min?: number;
  max?: number;
}

interface PropertyTestCodeInput {
  functionName: string;
  properties: PropertySpec[];
}

/**
 * Generate runnable fast-check property test code as a string.
 * Produces TypeScript that can be written to a file and executed.
 */
export function generatePropertyTestCode(input: PropertyTestCodeInput): string {
  const { functionName, properties } = input;
  const tests: string[] = [];

  for (const prop of properties) {
    switch (prop.type) {
      case "idempotency":
        tests.push(`
  it("${prop.description}", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), (x) => {
        const once = ${functionName}(x);
        const twice = ${functionName}(once);
        return once === twice;
      }),
      { numRuns: 100 }
    );
  });`);
        break;

      case "range":
        tests.push(`
  it("${prop.description}", () => {
    fc.assert(
      fc.property(fc.integer({ min: -10000, max: 10000 }), (x) => {
        const result = ${functionName}(x);
        return result >= ${prop.min ?? 0} && result <= ${prop.max ?? 100};
      }),
      { numRuns: 100 }
    );
  });`);
        break;

      case "commutativity":
        tests.push(`
  it("${prop.description}", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: -1000, max: 1000 }),
        (a, b) => {
          return ${functionName}(a, b) === ${functionName}(b, a);
        }
      ),
      { numRuns: 100 }
    );
  });`);
        break;
    }
  }

  return `import { describe, it } from "vitest";
import * as fc from "fast-check";
import { ${functionName} } from "./implementation";

describe("Property tests for ${functionName}", () => {
${tests.join("\n")}
});
`;
}
