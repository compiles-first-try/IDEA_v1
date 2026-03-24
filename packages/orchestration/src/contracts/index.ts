export interface AgentContract {
  agentId: string;
  preconditions: string[];
  postconditions: string[];
  invariants: string[];
  maxExecutionMs: number;
  maxTokensPerCall: number;
  allowedTools: string[];
  allowedModels: string[];
  requiresApproval: boolean;
  auditLevel: "FULL" | "SUMMARY";
}

export interface ConditionResult {
  passed: boolean;
  failures: string[];
}

export interface ExecutionGuard {
  isExpired: () => boolean;
  elapsedMs: () => number;
  remainingMs: () => number;
}

type ConditionChecker = (context: Record<string, unknown>) => boolean;

/**
 * Define an agent behavioral contract. Returns a frozen, immutable contract.
 */
export function defineContract(contract: AgentContract): Readonly<AgentContract> {
  return Object.freeze({ ...contract });
}

/**
 * Check all preconditions against a context using named checker functions.
 */
export function checkPreconditions(
  contract: Readonly<AgentContract>,
  context: Record<string, unknown>,
  checkers: Record<string, ConditionChecker>
): ConditionResult {
  const failures: string[] = [];

  for (const condition of contract.preconditions) {
    const checker = checkers[condition];
    if (!checker || !checker(context)) {
      failures.push(condition);
    }
  }

  return { passed: failures.length === 0, failures };
}

/**
 * Check all postconditions against output using named checker functions.
 */
export function checkPostconditions(
  contract: Readonly<AgentContract>,
  output: Record<string, unknown>,
  checkers: Record<string, ConditionChecker>
): ConditionResult {
  const failures: string[] = [];

  for (const condition of contract.postconditions) {
    const checker = checkers[condition];
    if (!checker || !checker(output)) {
      failures.push(condition);
    }
  }

  return { passed: failures.length === 0, failures };
}

/**
 * Check if a tool is allowed by the contract's whitelist.
 */
export function isToolAllowed(
  contract: Readonly<AgentContract>,
  tool: string
): boolean {
  if (contract.allowedTools.length === 0) return true; // empty = unrestricted
  return contract.allowedTools.includes(tool);
}

/**
 * Check if a model is allowed by the contract's whitelist.
 */
export function isModelAllowed(
  contract: Readonly<AgentContract>,
  model: string
): boolean {
  if (contract.allowedModels.length === 0) return true;
  return contract.allowedModels.includes(model);
}

/**
 * Check if token count is within the contract's per-call limit.
 */
export function isWithinTokenLimit(
  contract: Readonly<AgentContract>,
  tokens: number
): boolean {
  return tokens <= contract.maxTokensPerCall;
}

/**
 * Create an execution guard that tracks time against the contract's max execution.
 */
export function createExecutionGuard(
  contract: Readonly<AgentContract>
): ExecutionGuard {
  const startTime = Date.now();

  return {
    isExpired: () => Date.now() - startTime > contract.maxExecutionMs,
    elapsedMs: () => Date.now() - startTime,
    remainingMs: () => Math.max(0, contract.maxExecutionMs - (Date.now() - startTime)),
  };
}
