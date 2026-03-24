import { useState } from "react";
import { governanceApi } from "@/api/governance.ts";

export function KillSwitch() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const handleConfirm = async () => {
    setDisabled(true);
    setShowConfirm(false);
    try {
      await governanceApi.stop();
    } finally {
      setTimeout(() => setDisabled(false), 3000);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={disabled}
        className="rounded bg-[var(--color-accent-red)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        aria-label="Stop"
      >
        ■ STOP
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
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded border border-[var(--color-border)] px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
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
