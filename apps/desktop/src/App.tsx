import { TopBar } from "./components/layout/TopBar.tsx";
import { Sidebar } from "./components/layout/Sidebar.tsx";
import { MainPanel } from "./components/layout/MainPanel.tsx";
// Import theme store to ensure it initializes and applies default class to <html>
import "./store/theme.ts";

function App() {
  return (
    <div className="flex h-screen flex-col bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <MainPanel />
      </div>
    </div>
  );
}

export default App;
