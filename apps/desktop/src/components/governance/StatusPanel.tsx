interface ServiceHealth {
  name: string;
  healthy: boolean;
}

interface StatusData {
  killSwitchActive: boolean;
  dailySpend: number;
  autonomyLevel: string;
  timestamp: string;
}

interface StatusPanelProps {
  status: StatusData;
  services: ServiceHealth[];
}

export function StatusPanel({ status, services }: StatusPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6 text-sm">
        <div>
          <span className="text-[var(--color-text-secondary)]">Kill Switch: </span>
          <span className={status.killSwitchActive ? "text-[var(--color-accent-red)]" : "text-[var(--color-accent-green)]"}>
            {status.killSwitchActive ? "Active" : "Inactive"}
          </span>
        </div>
        <div>
          <span className="text-[var(--color-text-secondary)]">Daily Spend: </span>
          <span>${status.dailySpend.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[var(--color-text-secondary)]">Autonomy: </span>
          <span>{status.autonomyLevel}</span>
        </div>
      </div>

      {services.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {services.map((svc) => (
            <div
              key={svc.name}
              className="flex items-center gap-2 rounded border border-[var(--color-border)] px-3 py-1.5 text-xs"
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${svc.healthy ? "bg-[var(--color-accent-green)]" : "bg-[var(--color-accent-red)]"}`}
              />
              {svc.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
