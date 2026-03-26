# RSF Desktop — Build Instructions

## Architecture

The Tauri desktop app requires a **two-stage, two-OS build**. These stages CANNOT be combined into a single script.

| Stage | OS | Terminal | Command | Output |
|---|---|---|---|---|
| 1. Web assets | Linux (WSL2) | VS Code WSL2 terminal | `cd ~/Projects/IDEA_v1/apps/desktop && pnpm vite build` | `dist/` folder (HTML + JS + CSS) |
| 2. Native shell | Windows | PowerShell at W: drive | `cd W:\home\nicknoel251289\Projects\IDEA_v1\apps\desktop` then `pnpm tauri build --debug` | `rsf-desktop.exe` |

## Why Two Stages?

- **Stage 1** uses the WSL2 Node.js/pnpm toolchain where the project was developed and all 136 tests pass
- **Stage 2** uses the Windows Rust/Cargo toolchain to produce a native `.exe` with WebView2
- Cross-OS compilation is not possible: WSL2 Rust produces Linux ELF binaries, not Windows PE executables
- The W: drive (`\\wsl$\Ubuntu`) bridges the two filesystems

## DO NOT

- **DO NOT** wrap both stages in a single PowerShell script — PS 5.1 mangles bash syntax (`&&`, `$`, `\`), non-login shells lack PATH (nvm/node not found), and `Join-Path` only accepts 2 arguments
- **DO NOT** run `wsl -e bash -c` for the vite build from PowerShell — use the WSL2 terminal directly
- **DO NOT** attempt MSI packaging while CARGO_TARGET_DIR points to the WSL2 filesystem — WiX cannot create lock files on `\\wsl$\`. Set `CARGO_TARGET_DIR` to a Windows-local path for MSI builds

## Known Issues

| Issue | Status | Workaround |
|---|---|---|
| MSI installer fails (WiX lock files) | Open | Use .exe directly, or set CARGO_TARGET_DIR to Windows path |
| tsconfig.json requires `ignoreDeprecations: "5.0"` | Permanent | Windows has TS 7.x, WSL2 has TS 5.9 — value `"5.0"` is valid in all versions |

## Launch After Build
```powershell
& 'W:\home\nicknoel251289\Projects\IDEA_v1\apps\desktop\src-tauri\target\debug\rsf-desktop.exe'
```
