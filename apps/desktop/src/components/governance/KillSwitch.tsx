import { useState } from "react";
import { useKillSwitch } from "@/hooks/useKillSwitch.ts";
import { useFoundryStatus } from "@/hooks/useFoundryStatus.ts";

export function KillSwitch() {
  const [showConfirm, setShowConfirm] = useState(false);
  const killSwitch = useKillSwitch();
  const { data: status } = useFoundryStatus();
  const isStopped = status?.killSwitchActive === true;

  const handleStop = async () => {
    setShowConfirm(false);
    try {
      await killSwitch.activate();
    } catch {
      // error visible via killSwitch.isError
    }
  };

  const handleResume = async () => {
    try {
      await killSwitch.resume();
    } catch {
      // error visible via killSwitch.isError
    }
  };

  if (isStopped) {
    return (
      <button
        onClick={handleResume}
        disabled={killSwitch.isResuming}
        className="rounded bg-[var(--color-accent-green)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        aria-label="Resume"
      >
        {killSwitch.isResuming ? "Resuming..." : "Resume"}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={killSwitch.isPending}
        className="rounded bg-[var(--color-accent-red)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        aria-label="Stop"
      >
        {killSwitch.isPending ? "Stopping..." : "\u25a0 STOP"}
      </button>

      {showConfirm && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="w-[420px] rounded-lg bg-[var(--color-bg-elevated)] p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold">
              Stop all agent activity immediately?
            </h2>
            <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
              All running pipelines will halt. You can resume from the same button.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded border border-[var(--color-border)] px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleStop}
                className="rounded bg-[var(--color-accent-red)] px-4 py-2 text-sm font-semibold text-white"
              >
                Stop Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
