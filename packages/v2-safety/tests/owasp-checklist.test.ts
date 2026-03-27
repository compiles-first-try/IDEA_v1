/**
 * OWASP Agentic Top 10 Checklist (Dec 2025)
 *
 * Validates RSF against the OWASP Top 10 for Agentic Applications:
 * goal misalignment, tool misuse, delegated trust, inter-agent communication,
 * persistent memory, emergent autonomous behavior.
 */
import { describe, it, expect } from "vitest";

describe("OWASP Agentic Checklist", () => {
  let owasp: typeof import("../src/owasp-checklist/index.js");

  it("should load module", async () => {
    owasp = await import("../src/owasp-checklist/index.js");
    expect(owasp).toBeDefined();
  });

  it("should define all 10 OWASP agentic risk categories", () => {
    const categories = owasp.getRiskCategories();
    expect(categories.length).toBeGreaterThanOrEqual(10);
    expect(categories.map((c: { id: string }) => c.id)).toContain("GOAL_MISALIGNMENT");
    expect(categories.map((c: { id: string }) => c.id)).toContain("TOOL_MISUSE");
    expect(categories.map((c: { id: string }) => c.id)).toContain("MEMORY_MANIPULATION");
  });

  it("should assess a system configuration against the checklist", () => {
    const assessment = owasp.assess({
      hasKillSwitch: true,
      hasAuditLog: true,
      hasBehavioralContracts: true,
      hasModelWhitelist: true,
      hasSandboxIsolation: true,
      hasHumanApprovalGate: true,
      hasCrossAgentMonitoring: true,
      hasMemoryAccessControl: true,
      hasInputValidation: true,
      hasOutputFiltering: true,
    });

    expect(assessment.overallScore).toBeGreaterThan(0);
    expect(assessment.overallScore).toBeLessThanOrEqual(1);
    expect(assessment.findings).toBeDefined();
    expect(Array.isArray(assessment.findings)).toBe(true);
  });

  it("should flag missing controls", () => {
    const assessment = owasp.assess({
      hasKillSwitch: true,
      hasAuditLog: true,
      hasBehavioralContracts: false,
      hasModelWhitelist: false,
      hasSandboxIsolation: true,
      hasHumanApprovalGate: false,
      hasCrossAgentMonitoring: false,
      hasMemoryAccessControl: false,
      hasInputValidation: true,
      hasOutputFiltering: false,
    });

    expect(assessment.overallScore).toBeLessThan(0.7);
    expect(assessment.findings.filter((f: { severity: string }) => f.severity === "HIGH").length).toBeGreaterThan(0);
  });

  it("should produce per-category results", () => {
    const assessment = owasp.assess({
      hasKillSwitch: true, hasAuditLog: true, hasBehavioralContracts: true,
      hasModelWhitelist: true, hasSandboxIsolation: true, hasHumanApprovalGate: true,
      hasCrossAgentMonitoring: true, hasMemoryAccessControl: true,
      hasInputValidation: true, hasOutputFiltering: true,
    });

    expect(assessment.categoryResults).toBeDefined();
    expect(Object.keys(assessment.categoryResults).length).toBeGreaterThanOrEqual(10);
  });
});
