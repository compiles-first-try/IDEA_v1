/**
 * AgentSpec DSL Runtime Enforcement
 *
 * Lightweight rule-based DSL for specifying and enforcing runtime constraints
 * on agent behavior. Inspired by AgentSpec (ICSE 2026, >90% prevention rate).
 */

export interface RuleDefinition {
  name: string;
  trigger: string;
  predicate: (ctx: any) => boolean;
  action: "BLOCK" | "WARN";
  message: string;
}

export interface Rule extends Readonly<RuleDefinition> {}

export interface EnforceResult {
  allowed: boolean;
  blockedBy?: string;
  warnings: string[];
}

const PROTECTED_PATTERNS = [
  "audit",
  "secrets",
  "kill-switch",
  "kill_switch",
  "locked-constitution",
  "router",
  "scripts/gate",
  "db/migrations",
  "CLAUDE.md",
  "CLAUDE_V2.md",
  "UI_CLAUDE.md",
];

export function defineRule(definition: RuleDefinition): Rule {
  return Object.freeze({ ...definition });
}

export function enforce(rules: Rule[], context: { trigger: string;[key: string]: any }): EnforceResult {
  const warnings: string[] = [];
  for (const rule of rules) {
    if (rule.trigger !== context.trigger) continue;
    if (!rule.predicate(context)) continue;
    if (rule.action === "BLOCK") {
      return { allowed: false, blockedBy: rule.name, warnings };
    }
    if (rule.action === "WARN") {
      warnings.push(`${rule.name}: ${rule.message}`);
    }
  }
  return { allowed: true, warnings };
}

export function isProtectedPath(path: string): boolean {
  return PROTECTED_PATTERNS.some((pattern) => path.includes(pattern));
}
