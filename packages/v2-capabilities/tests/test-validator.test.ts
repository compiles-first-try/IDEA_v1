/**
 * Recursive Test Validation
 *
 * Independent model validates generated tests for coverage, correctness,
 * and gameability. Structurally independent from the test generator.
 */
import { describe, it, expect, beforeAll } from "vitest";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

describe("Test Validator", () => {
  let validator: typeof import("../src/test-validator/index.js");

  beforeAll(async () => {
    validator = await import("../src/test-validator/index.js");
  });

  it("should check coverage of requirements", () => {
    const result = validator.checkCoverage({
      requirements: ["adds two numbers", "handles negative inputs", "returns a number"],
      testCode: `
        it("adds two numbers", () => { expect(add(1,2)).toBe(3); });
        it("handles negatives", () => { expect(add(-1,2)).toBe(1); });
      `,
    });
    expect(result.coveredRequirements).toBe(2);
    expect(result.totalRequirements).toBe(3);
    expect(result.uncoveredRequirements).toContain("returns a number");
  });

  it("should detect gameability — trivial implementation could pass", () => {
    const result = validator.checkGameability({
      functionName: "add",
      testCode: `
        it("adds", () => { expect(add(1,2)).toBe(3); });
      `,
    });
    expect(result.gameable).toBe(true);
    expect(result.reason).toContain("single");
  });

  it("should detect non-gameability — multiple diverse assertions", () => {
    const result = validator.checkGameability({
      functionName: "add",
      testCode: `
        it("adds positives", () => { expect(add(1,2)).toBe(3); });
        it("adds negatives", () => { expect(add(-1,-2)).toBe(-3); });
        it("adds zero", () => { expect(add(0,5)).toBe(5); });
        it("adds large", () => { expect(add(1000,2000)).toBe(3000); });
        it("is commutative", () => { expect(add(3,7)).toBe(add(7,3)); });
      `,
    });
    expect(result.gameable).toBe(false);
  });

  it("should produce a validation report", () => {
    const report = validator.validate({
      requirements: ["adds two numbers", "handles negative inputs"],
      edgeCases: ["zero input", "very large numbers"],
      testCode: `
        it("adds", () => { expect(add(1,2)).toBe(3); });
        it("handles negatives", () => { expect(add(-1,-2)).toBe(-3); });
        it("handles zero", () => { expect(add(0,0)).toBe(0); });
        it("large numbers", () => { expect(add(1e10,1e10)).toBe(2e10); });
      `,
      functionName: "add",
    });

    expect(report.coverageScore).toBeGreaterThan(0);
    expect(report.gameabilityCheck).toBeDefined();
    expect(report.overallVerdict).toBeDefined();
    expect(["PASS", "FAIL"]).toContain(report.overallVerdict);
  });
});
