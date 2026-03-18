# STIRUAL

STIRUAL is a canvas-based workspace for coordinating multiple AI agents, terminals, browsers, and notes in one place.

It is designed for workflows where you are:

- running several Claude Code / Codex sessions at once
- mixing local work and remote VPS work
- monitoring browser surfaces alongside terminals
- organizing work spatially instead of through tabs alone

## What it does

- Infinite-feeling canvas workspace
- Draggable terminal, browser, and text tiles
- Attention queue for terminals that need input or finish work
- Minimap navigation
- Browser tiles with lightweight controls
- Fast spawn shortcuts for terminal, browser, and paragraph tiles
- Windows desktop app built with Electron

## Why it exists

Most terminal apps are too low-level for multi-agent work, and most IDE-like tools are too repo-centric.

STIRUAL is meant to be a control room:

- terminals as live work surfaces
- browsers as verification surfaces
- notes as coordination surfaces
- the whole system visible at once

## Tech

- Electron
- React
- Zustand
- xterm.js
- Tailwind CSS

## Getting started

```powershell
npm install
npm run dev
```

Build production assets:

```powershell
npm run build
```

Build a Windows installer:

```powershell
npm run dist:win
```

## Current state

STIRUAL is usable and actively evolving, but terminal fidelity under heavy TUI workloads is still the most important area of ongoing improvement.

## License

MIT
