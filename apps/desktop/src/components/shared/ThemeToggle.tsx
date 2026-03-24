import { useThemeStore } from "@/store/theme.ts";

const MODES = ["dark", "light", "system"] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="flex gap-1">
      {MODES.map((mode) => (
        <button
          key={mode}
          onClick={() => setTheme(mode)}
          aria-label={mode.charAt(0).toUpperCase() + mode.slice(1)}
          className={`rounded px-2 py-1 text-xs capitalize ${
            theme === mode
              ? "bg-[var(--color-accent-blue)] text-white"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}
