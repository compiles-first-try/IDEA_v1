import { useFoundryStatus } from "@/hooks/useFoundryStatus.ts";
import { KillSwitch } from "@/components/governance/KillSwitch.tsx";

export function TopBar() {
  const { data: status } = useFoundryStatus();

  const isRunning = status && !status.killSwitchActive;
  const spend = status?.dailySpend ?? 0;

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4">
      {/* Left: branding + status */}
      <div className="flex items-center gap-6">
        <span className="text-sm font-semibold">RSF</span>

        <div className="flex items-center gap-2 text-xs">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isRunning
                ? "bg-[var(--color-accent-green)]"
                : "bg-[var(--color-accent-red)]"
            }`}
          />
          <span className="text-[var(--color-text-secondary)]">
            {isRunning ? "Running" : "Stopped"}
          </span>
        </div>

        <span className="text-xs text-[var(--color-text-secondary)]">
          Spend:{" "}
          <span
            className={
              spend > 15
                ? "text-[var(--color-accent-red)]"
                : spend > 8
                  ? "text-[var(--color-accent-amber)]"
                  : "text-[var(--color-accent-green)]"
            }
          >
            ${spend.toFixed(2)}
          </span>
          {" / day"}
        </span>
      </div>

      {/* Right: kill switch — always visible */}
      <KillSwitch />
    </header>
  );
}
