/**
 * OWASP Agentic Top 10 Checklist (Dec 2025)
 *
 * Validates RSF against the OWASP Top 10 for Agentic Applications.
 */

export interface RiskCategory {
  id: string;
  name: string;
  description: string;
  controls: string[];
}

export interface Finding {
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
}

export interface Assessment {
  overallScore: number;
  findings: Finding[];
  categoryResults: Record<string, { score: number; controls: string[] }>;
}

export interface SystemConfig {
  hasKillSwitch: boolean;
  hasAuditLog: boolean;
  hasBehavioralContracts: boolean;
  hasModelWhitelist: boolean;
  hasSandboxIsolation: boolean;
  hasHumanApprovalGate: boolean;
  hasCrossAgentMonitoring: boolean;
  hasMemoryAccessControl: boolean;
  hasInputValidation: boolean;
  hasOutputFiltering: boolean;
}

const CATEGORIES: RiskCategory[] = [
  {
    id: "GOAL_MISALIGNMENT",
    name: "Goal Misalignment",
    description: "Agent pursues objectives that diverge from user intent",
    controls: ["hasBehavioralContracts", "hasHumanApprovalGate"],
  },
  {
    id: "TOOL_MISUSE",
    name: "Tool Misuse",
    description: "Agent uses tools in unintended or harmful ways",
    controls: ["hasSandboxIsolation", "hasInputValidation"],
  },
  {
    id: "DELEGATED_TRUST",
    name: "Delegated Trust",
    description: "Agent delegates authority without proper verification",
    controls: ["hasHumanApprovalGate", "hasAuditLog"],
  },
  {
    id: "INTER_AGENT_COMMUNICATION",
    name: "Inter-Agent Communication",
    description: "Agents exchange information that enables coordinated harmful behavior",
    controls: ["hasCrossAgentMonitoring", "hasAuditLog"],
  },
  {
    id: "PERSISTENT_MEMORY",
    name: "Persistent Memory",
    description: "Agent memory is exploited to influence future behavior",
    controls: ["hasMemoryAccessControl", "hasInputValidation"],
  },
  {
    id: "EMERGENT_BEHAVIOR",
    name: "Emergent Behavior",
    description: "Agent exhibits unexpected autonomous behavior beyond its specification",
    controls: ["hasKillSwitch", "hasBehavioralContracts"],
  },
  {
    id: "MEMORY_MANIPULATION",
    name: "Memory Manipulation",
    description: "External actors tamper with agent memory to alter behavior",
    controls: ["hasMemoryAccessControl", "hasAuditLog"],
  },
  {
    id: "PRIVILEGE_ESCALATION",
    name: "Privilege Escalation",
    description: "Agent acquires permissions beyond its authorized scope",
    controls: ["hasSandboxIsolation", "hasModelWhitelist"],
  },
  {
    id: "SUPPLY_CHAIN",
    name: "Supply Chain",
    description: "Compromised tools, models, or dependencies introduce vulnerabilities",
    controls: ["hasInputValidation", "hasOutputFiltering"],
  },
  {
    id: "OUTPUT_INTEGRITY",
    name: "Output Integrity",
    description: "Agent produces outputs that are incorrect, biased, or harmful",
    controls: ["hasOutputFiltering", "hasAuditLog"],
  },
];

export function getRiskCategories(): RiskCategory[] {
  return [...CATEGORIES];
}

export function assess(config: SystemConfig): Assessment {
  const findings: Finding[] = [];
  const categoryResults: Record<string, { score: number; controls: string[] }> = {};

  let totalScore = 0;

  for (const category of CATEGORIES) {
    const presentControls: string[] = [];
    const missingControls: string[] = [];

    for (const control of category.controls) {
      if (config[control as keyof SystemConfig]) {
        presentControls.push(control);
      } else {
        missingControls.push(control);
      }
    }

    const score = category.controls.length > 0
      ? presentControls.length / category.controls.length
      : 1;

    categoryResults[category.id] = { score, controls: presentControls };
    totalScore += score;

    for (const missing of missingControls) {
      const severity: Finding["severity"] = score === 0 ? "HIGH" : "MEDIUM";
      findings.push({
        category: category.id,
        severity,
        message: `Missing control: ${missing} for ${category.name}`,
      });
    }
  }

  const overallScore = totalScore / CATEGORIES.length;

  return { overallScore, findings, categoryResults };
}
