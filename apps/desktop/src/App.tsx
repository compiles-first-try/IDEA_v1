import { useThemeStore } from "./store/theme.ts";

function App() {
  const theme = useThemeStore((s) => s.theme);

  return (
    <div
      className={`min-h-screen ${theme === "dark" ? "bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]" : "bg-white text-gray-900"}`}
    >
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-3">
        <h1 className="text-lg font-semibold">Recursive Software Foundry</h1>
        <span className="text-sm text-[var(--color-text-secondary)]">
          v1.0.0 — Governance Dashboard
        </span>
      </header>
      <main className="p-6">
        <p className="text-[var(--color-text-secondary)]">
          Dashboard loading…
        </p>
      </main>
    </div>
  );
}

export default App;
