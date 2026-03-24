import { useThemeStore } from "./store/theme.ts";
import { TopBar } from "./components/layout/TopBar.tsx";
import { Sidebar } from "./components/layout/Sidebar.tsx";
import { MainPanel } from "./components/layout/MainPanel.tsx";

function App() {
  const theme = useThemeStore((s) => s.theme);
  const themeClass = theme === "light" ? "light" : "";

  return (
    <div
      className={`${themeClass} flex h-screen flex-col bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]`}
    >
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <MainPanel />
      </div>
    </div>
  );
}

export default App;
