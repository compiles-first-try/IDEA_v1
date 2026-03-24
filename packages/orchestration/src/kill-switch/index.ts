import type { Express, Request, Response } from "express";
import type { CacheClient } from "@rsf/foundation";
import type { AuditLogger } from "@rsf/foundation";

const REDIS_KILL_KEY = "rsf:kill:global";

export type KillTrigger = "HTTP" | "ENV" | "SIGNAL" | "REDIS";

export interface KillSwitch {
  /** Check if any kill mechanism is active */
  isActive: () => Promise<boolean>;
  /** Activate the kill switch */
  activate: (triggeredBy: string, mechanism: KillTrigger) => Promise<void>;
  /** Reset the kill switch (clear Redis flag) */
  reset: () => Promise<void>;
  /** Mount HTTP routes onto an Express app */
  mountRoutes: (app: Express) => void;
}

interface KillSwitchDeps {
  cache: CacheClient;
  auditLogger: AuditLogger;
}

/**
 * Create a Kill Switch with 3 independent mechanisms:
 * 1. Redis flag (rsf:kill:global)
 * 2. Environment variable (FOUNDRY_KILL=1)
 * 3. SIGTERM/SIGINT handler (external — scripts/kill-switch.sh)
 *
 * All agent loops must call isActive() before each iteration.
 * Every activation is logged to the audit system.
 */
export async function createKillSwitch(deps: KillSwitchDeps): Promise<KillSwitch> {
  const { cache, auditLogger } = deps;

  async function isActive(): Promise<boolean> {
    // Mechanism 1: Redis flag
    const redisFlag = await cache.get(REDIS_KILL_KEY);
    if (redisFlag === "1") return true;

    // Mechanism 2: Environment variable
    if (
      process.env.FOUNDRY_KILL === "1" ||
      process.env.FOUNDRY_KILL === "true"
    ) {
      return true;
    }

    return false;
  }

  async function activate(
    triggeredBy: string,
    mechanism: KillTrigger
  ): Promise<void> {
    // Set Redis flag (no TTL — stays until explicitly reset)
    await cache.set(REDIS_KILL_KEY, "1");

    // Audit the kill event — immutable, cannot be deleted
    await auditLogger.log({
      agentId: "kill-switch",
      agentType: "GOVERNANCE",
      actionType: "KILL_SWITCH_ACTIVATED",
      phase: "KILL",
      inputs: { triggered_by: triggeredBy, mechanism },
      status: "SUCCESS",
      durationMs: 0,
    });
  }

  async function reset(): Promise<void> {
    await cache.del(REDIS_KILL_KEY);
  }

  function mountRoutes(app: Express): void {
    app.post("/governance/stop", async (_req: Request, res: Response) => {
      try {
        await activate("http-api", "HTTP");
        res.json({ killed: true, timestamp: new Date().toISOString() });
      } catch (err) {
        res.status(500).json({ error: "Failed to activate kill switch" });
      }
    });

    app.get("/governance/status", async (_req: Request, res: Response) => {
      try {
        const active = await isActive();
        res.json({ active, timestamp: new Date().toISOString() });
      } catch (err) {
        res.status(500).json({ error: "Failed to check kill switch status" });
      }
    });
  }

  return { isActive, activate, reset, mountRoutes };
}
