# RSF Desktop

Desktop governance dashboard for the Recursive Software Foundry. Built with Tauri v2, React 19, and TypeScript.

## Prerequisites

### All Platforms
- Node.js 22+ and pnpm 9+
- Docker (for RSF infrastructure services)
- RSF foundry running (`docker compose up -d` from project root)
- Governance API running (`pnpm --filter @rsf/foundation exec tsx ../../packages/governance/src/server.ts`)

### Windows
- Rust toolchain: [https://rustup.rs](https://rustup.rs)
- WebView2 Runtime (included in Windows 10 1803+ and Windows 11)

### Linux (Ubuntu/Debian)
- Rust toolchain: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- System libraries:
  ```bash
  sudo apt-get install -y \
    libwebkit2gtk-4.1-dev libappindicator3-dev \
    librsvg2-dev patchelf libssl-dev libgtk-3-dev
  ```

## Development

```bash
# From the project root (~/Projects/IDEA_v1)

# 1. Start infrastructure
docker compose up -d

# 2. Start governance API (in a separate terminal)
pnpm --filter @rsf/foundation exec tsx ../../packages/governance/src/server.ts

# 3. Start desktop app in dev mode
cd apps/desktop
pnpm tauri dev
```

The dev server runs the React frontend at `http://localhost:1420` with hot module replacement. The Tauri shell wraps it in a native window.

## Testing

```bash
# Run all component tests (Vitest + React Testing Library)
pnpm --filter @rsf/desktop test

# Run with watch mode
pnpm --filter @rsf/desktop test:watch

# TypeScript type check
pnpm --filter @rsf/desktop typecheck
```

## Building

### Windows (from PowerShell)

```powershell
# Navigate to the project in WSL2 filesystem
cd \\wsl$\Ubuntu\home\<user>\Projects\IDEA_v1\apps\desktop

# Build debug installer
pnpm tauri build --debug

# Output: src-tauri/target/debug/bundle/
#   - msi/RSF Desktop_1.0.0_x64_en-US.msi
#   - nsis/RSF Desktop_1.0.0_x64-setup.exe
```

### Linux

```bash
cd apps/desktop
pnpm tauri build --debug

# Output: src-tauri/target/debug/bundle/
#   - deb/rsf-desktop_1.0.0_amd64.deb
#   - appimage/rsf-desktop_1.0.0_amd64.AppImage
```

## Architecture

```
apps/desktop/
  src/                    React frontend
    components/           UI components (by section)
    hooks/                Custom React hooks
    api/                  Governance API client
    store/                Zustand state stores
    styles/               Tailwind CSS + theme variables
  src-tauri/              Rust Tauri shell (minimal)
  tests/                  Vitest + RTL component tests
```

The desktop app is a **thin client** — all business logic runs in the governance REST API. The UI only renders state received from the API and sends user actions back to it.

## Configuration

The app connects to the governance API via environment variables:
- `VITE_API_BASE_URL` — REST API base (default: `http://localhost:3000`)
- `VITE_WS_URL` — WebSocket URL (default: `ws://localhost:3000/audit-stream`)

## License

Proprietary — Recursive Software Foundry
