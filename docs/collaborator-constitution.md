# Canvas Workspace Constitution

This document is the source of truth for the app from this point onward.

The scope is intentionally narrower now:

- **canvas first**
- **minimal top toolbar**
- **tiles as the core object**
- **text labels on the canvas**
- **grouping on the canvas**

We are no longer trying to build a full navigator-driven workspace shell first.
We are building the spatial canvas product first.

## Product Goal

Build a desktop app where the user can arrange work spatially on an infinite canvas.

The app should feel like:

- a dense desktop workspace
- a tile-based thinking surface
- a terminal canvas for agents and tooling
- a structured version of Excalidraw-like freeform organization

This is **not**:

- a dashboard
- a file tree app first
- a machine-card admin panel
- a generic terminal tab app

## Core User Story

The user opens the app and can:

1. create a terminal tile
2. create a browser tile
3. create a text label tile
4. move and resize tiles freely
5. group related tiles visually
6. label regions/flows on the canvas
7. reopen the app and restore the same layout

That is the primary experience.

## Layout Constitution

The shell should be extremely simple:

1. **Top toolbar**
2. **Canvas**

That’s it for v1.

Optional overlays/modals are allowed.
But there is no heavy permanent sidebar requirement in v1.

## Top Toolbar

The toolbar must be:

- thin
- quiet
- dense
- utility-first

It should contain:

- new tile actions
- current mode/context controls
- zoom or view controls
- command/menu affordance

It must not dominate the window.

## Canvas Constitution

The canvas is the hero.

It must:

- fill almost all of the app
- support pan and zoom
- show a subtle dot grid
- feel infinite
- support snap/alignment behavior later

The canvas must never feel like a content panel with decorations.

## Tile Constitution

Tiles are the main product primitive.

Every tile must support:

- drag
- resize
- focus
- z-order
- close
- persistence

Every tile type shares the same interaction grammar.

## Required v1 Tile Types

### 1. Terminal tile

- primary tile type
- runs Claude, Codex, or shell sessions
- can be local or remote later
- durable session backing

### 2. Browser tile

- embedded browser/webview surface
- useful for docs, dashboards, tools, research

### 3. Text label tile

- lightweight freeform text block
- used like Excalidraw text to label areas and flows
- editable directly on the canvas

### 4. Group container or grouping behavior

We do not need a heavyweight folder model.
But we do need a way to visually group tiles.

Acceptable v1 forms:

- soft group frames
- named regions
- colored/labeled containers

The purpose is orchestration and readability, not hierarchy for its own sake.

## Text / Annotation Rules

Text on canvas is first-class.

The user must be able to:

- place standalone text labels
- rename groups/regions
- annotate what a set of terminals is for

This is a core product requirement, not a nice-to-have.

## Interaction Rules

### Required v1 interactions

- create tile from toolbar
- create tile from command flow
- double-click canvas to create a default tile later if useful
- drag tiles
- resize tiles
- select/focus tiles
- edit text labels inline
- group tiles
- persist layout

### Keyboard-first expectations

Keyboard flow should exist for:

- create tile
- search commands
- zoom/reset
- focus selected tile
- rename label/group

Mouse is still important, but keyboard support is part of the product.

## Visual Design Rules

### Tone

- dark
- restrained
- dense
- professional
- spatial

### Density

High density is intentional.
No oversized dashboard cards.
No giant padded containers pretending to be polished.

### Typography

- compact sans for UI chrome
- monospace where terminal/code metadata benefits from it
- text labels on canvas should be clear and elegant, not toy-like

### Spacing

Use a tight spacing system:

- 4
- 8
- 12
- 16
- 20

### Surfaces

- low-contrast dark surfaces
- subtle borders
- restrained shadows
- compact titlebars

### Color

- mostly monochrome base
- accent only for semantic meaning
- no AI-slop gradients

## Engineering Rules

### Stack

- Electron
- React
- Tailwind
- shadcn/ui primitives only where helpful
- xterm for terminals

### State Model

Persist:

- canvas viewport
- tile list
- tile positions
- tile sizes
- tile z-order
- tile metadata
- text label content
- grouping metadata

Runtime session state must remain separate from persisted canvas state.

### Session Truthfulness

The UI must not lie about terminal state.
No tile may show `live` if the underlying session failed.

### Error Handling

- no silent black windows
- visible boot errors
- visible tile/session errors

## Explicit Non-Goals For v1

- full file tree
- repo navigator
- workspace switcher complexity
- complex browser/devtools integration
- multi-pane dashboard shell

Those can come later if the canvas product proves itself.

## Immediate Implementation Direction

Next build steps:

1. strip the current layout down to top toolbar + canvas
2. build a real canvas model
3. implement terminal tile
4. implement text label tile
5. implement browser tile shell
6. implement grouping / region labels
7. restore session correctness and polish after the canvas interaction model is stable
