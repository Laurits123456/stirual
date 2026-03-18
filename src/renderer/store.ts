import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HostConfig, SessionPreset } from "@/main/session-manager";

export type ConnectionState = "disconnected" | "connecting" | "live" | "failed";
export type TerminalAttentionState = "idle" | "needs-input" | "done" | "failed";
export type LinkEdge = {
  id: string;
  fromTileId: string;
  toTileId: string;
};
export type ToastNotice = {
  id: string;
  tileId: string;
  title: string;
  message: string;
  tone: "info" | "success" | "warning" | "danger";
  createdAt: number;
};

export type BaseTile = {
  id: string;
  kind: "terminal" | "browser" | "text" | "frame";
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
};

export type TerminalTile = BaseTile & {
  kind: "terminal";
  host: HostConfig;
  preset: SessionPreset;
  command?: string;
  cwd?: string;
  sessionName: string;
  runtimeSessionId?: string;
  connectionState: ConnectionState;
  attention: TerminalAttentionState;
  lastPreview: string;
  lastActivityAt?: number;
  outputBuffer: string;
};

export type BrowserTile = BaseTile & {
  kind: "browser";
  url: string;
  reloadKey: number;
};

export type TextTile = BaseTile & {
  kind: "text";
  text: string;
  fontSize: number;
  color: string;
};

export type FrameTile = BaseTile & {
  kind: "frame";
  label: string;
};

export type CanvasTile = TerminalTile | BrowserTile | TextTile | FrameTile;
type ClipboardTileSnapshot = CanvasTile;

type ViewportState = {
  panX: number;
  panY: number;
  zoom: number;
};

type DeckState = {
  version: string;
  viewport: ViewportState;
  pointerWorld: { x: number; y: number };
  hosts: HostConfig[];
  tiles: Record<string, CanvasTile>;
  links: LinkEdge[];
  toasts: ToastNotice[];
  selectedTileIds: string[];
  clipboardTiles: ClipboardTileSnapshot[];
  setVersion: (version: string) => void;
  setPointerWorld: (x: number, y: number) => void;
  setViewportZoom: (zoom: number) => void;
  setViewportPan: (panX: number, panY: number) => void;
  focusTile: (tileId: string) => void;
  selectTiles: (tileIds: string[]) => void;
  toggleTileSelection: (tileId: string) => void;
  clearSelection: () => void;
  centerOnTile: (tileId: string) => void;
  moveTile: (tileId: string, x: number, y: number) => void;
  moveTiles: (tileIds: string[], dx: number, dy: number) => void;
  resizeTile: (tileId: string, width: number, height: number) => void;
  updateBrowserUrl: (tileId: string, url: string) => void;
  reloadBrowserTile: (tileId: string) => void;
  updateTextTile: (tileId: string, text: string) => void;
  updateTextStyle: (tileId: string, patch: Partial<Pick<TextTile, "fontSize" | "color">>) => void;
  updateFrameLabel: (tileId: string, label: string) => void;
  upsertHost: (host: HostConfig) => void;
  createTerminalTile: (
    x?: number,
    y?: number,
    options?: Partial<Pick<TerminalTile, "host" | "preset" | "title" | "command" | "cwd">>
  ) => string;
  createBrowserTile: (x?: number, y?: number) => string;
  createTextTile: (x?: number, y?: number) => string;
  createFrameTile: (x?: number, y?: number) => string;
  copySelectedTiles: () => void;
  pasteClipboardTiles: (x?: number, y?: number) => string[];
  addLink: (fromTileId: string, toTileId: string) => void;
  removeLink: (linkId: string) => void;
  closeTile: (tileId: string) => void;
  setTerminalRuntime: (
    tileId: string,
    runtimeSessionId?: string,
    state?: ConnectionState
  ) => void;
  setTerminalFailure: (tileId: string, message: string) => void;
  appendTerminalOutput: (runtimeSessionId: string, data: string) => void;
  markTerminalExited: (runtimeSessionId: string) => void;
  restartTerminalTile: (tileId: string) => void;
  clearTerminalAttention: (tileId: string) => void;
  dismissToast: (toastId: string) => void;
  clearRuntimeState: () => void;
  remapWorld: (deltaX: number, deltaY: number) => void;
};

export const LOCAL_HOST: HostConfig = {
  id: "host-local-machine",
  name: "Local Machine",
  kind: "local"
};
export const DEFAULT_HOSTS: HostConfig[] = [
  LOCAL_HOST,
  {
    id: "host-personal-claw",
    name: "Personal Claw",
    kind: "ssh",
    username: "root",
    address: "37.27.86.35"
  },
  {
    id: "host-berry-claw",
    name: "Berry Claw",
    kind: "ssh",
    username: "root",
    address: "89.167.116.61"
  }
];

const INITIAL_VIEWPORT: ViewportState = {
  panX: 0,
  panY: 0,
  zoom: 1
};

const WORLD_CENTER = 12000;

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nextZIndex(tiles: Record<string, CanvasTile>) {
  return Object.values(tiles).reduce((max, tile) => Math.max(max, tile.zIndex), 0) + 1;
}

function makeSessionName(title: string) {
  return `${title.toLowerCase().replace(/\s+/g, "-")}-${Math.floor(Date.now() / 1000)}`;
}

function getPreview(buffer: string) {
  const lines = buffer
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.at(-1)?.slice(0, 120) || "No activity yet";
}

function snap(value: number) {
  return Math.round(value / 4) * 4;
}

function defaultTerminalSize(preset: SessionPreset) {
  if (preset === "shell") {
    return { width: 640, height: 920 };
  }
  return { width: 1220, height: 520 };
}

function createTerminal(
  x: number,
  y: number,
  zIndex: number,
  options?: Partial<Pick<TerminalTile, "host" | "preset" | "title" | "command" | "cwd">>
): TerminalTile {
  const preset = options?.preset || "shell";
  const size = defaultTerminalSize(preset);
  return {
    id: makeId("tile"),
    kind: "terminal",
    title:
      options?.title ||
      (preset === "shell"
        ? "Terminal"
        : preset === "claude"
          ? "Claude"
          : preset === "claude-resume"
            ? "Claude Resume"
            : preset === "codex"
              ? "Codex"
              : preset === "codex-resume"
                ? "Codex Resume"
                : "Command"),
    x,
    y,
    width: size.width,
    height: size.height,
    zIndex,
    host: options?.host || LOCAL_HOST,
    preset,
    command: options?.command,
    cwd: options?.cwd,
    sessionName: makeSessionName(options?.title || preset),
    connectionState: "connecting",
    attention: "idle",
    lastPreview: "Connecting...",
    outputBuffer: ""
  };
}

function createBrowser(x: number, y: number, zIndex: number): BrowserTile {
  return {
    id: makeId("tile"),
    kind: "browser",
    title: "Browser",
    x,
    y,
    width: 1500,
    height: 760,
    zIndex,
    url: "about:blank",
    reloadKey: 0
  };
}

function createText(x: number, y: number, zIndex: number): TextTile {
  return {
    id: makeId("tile"),
    kind: "text",
    title: "Paragraph",
    x,
    y,
    width: 520,
    height: 240,
    zIndex,
    text: "Write a note...",
    fontSize: 34,
    color: "#f4f1ea"
  };
}

function createFrame(x: number, y: number, zIndex: number): FrameTile {
  return {
    id: makeId("tile"),
    kind: "frame",
    title: "Group",
    x,
    y,
    width: 760,
    height: 460,
    zIndex,
    label: "New Group"
  };
}

function createTileAtPointer<T extends CanvasTile>(
  factory: (x: number, y: number, zIndex: number, options?: any) => T,
  getState: () => DeckState,
  setState: (partial: Partial<DeckState> | ((state: DeckState) => Partial<DeckState>), replace?: false) => void,
  x?: number,
  y?: number,
  options?: any
) {
  const state = getState();
  const baseX = x ?? state.pointerWorld.x;
  const baseY = y ?? state.pointerWorld.y;
  let spawnX = baseX;
  let spawnY = baseY;
  for (let i = 0; i < 12; i++) {
    const collides = Object.values(state.tiles).some(
      (tile) =>
        Math.abs(tile.x - spawnX) < 120 &&
        Math.abs(tile.y - spawnY) < 120
    );
    if (!collides) {
      break;
    }
    spawnX += 48;
    spawnY += 32;
  }
  const tile = factory(spawnX, spawnY, nextZIndex(state.tiles), options);
  setState({
    tiles: { ...state.tiles, [tile.id]: tile },
    selectedTileIds: [tile.id]
  });
  return tile.id;
}

function cloneTileForPaste(tile: ClipboardTileSnapshot, x: number, y: number, zIndex: number): CanvasTile {
  switch (tile.kind) {
    case "terminal":
      return {
        id: makeId("tile"),
        kind: "terminal",
        title: tile.title,
        x,
        y,
        width: tile.width,
        height: tile.height,
        zIndex,
        host: tile.host,
        preset: tile.preset,
        sessionName: makeSessionName(tile.title),
        runtimeSessionId: undefined,
        connectionState: "connecting",
        attention: "idle",
        lastPreview: "Connecting...",
        lastActivityAt: undefined,
        outputBuffer: "",
        command: tile.command,
        cwd: tile.cwd
      };
    case "browser":
      return {
        id: makeId("tile"),
        kind: "browser",
        title: tile.title,
        x,
        y,
        width: tile.width,
        height: tile.height,
        zIndex,
        url: tile.url,
        reloadKey: 0
      };
    case "text":
      return {
        id: makeId("tile"),
        kind: "text",
        title: tile.title,
        x,
        y,
        width: tile.width,
        height: tile.height,
        zIndex,
        text: tile.text,
        fontSize: tile.fontSize,
        color: tile.color
      };
    case "frame":
      return {
        id: makeId("tile"),
        kind: "frame",
        title: tile.title,
        x,
        y,
        width: tile.width,
        height: tile.height,
        zIndex,
        label: tile.label
      };
  }
}

export const useDeckStore = create<DeckState>()(
  persist(
    (set, get) => ({
      version: "dev",
      viewport: INITIAL_VIEWPORT,
      pointerWorld: { x: WORLD_CENTER - 240, y: WORLD_CENTER - 140 },
      hosts: DEFAULT_HOSTS,
      tiles: {},
      links: [],
      toasts: [],
      selectedTileIds: [],
      clipboardTiles: [],
      setVersion: (version) => set({ version }),
      setPointerWorld: (x, y) => set({ pointerWorld: { x, y } }),
      setViewportZoom: (zoom) =>
        set((state) => ({
          viewport: {
            ...state.viewport,
            zoom: Math.max(0.2, Math.min(1.75, zoom))
          }
        })),
      setViewportPan: (panX, panY) =>
        set((state) => ({
          viewport: { ...state.viewport, panX, panY }
        })),
      focusTile: (tileId) =>
        set((state) => {
          const tile = state.tiles[tileId];
          if (!tile) {
            return state;
          }
          return {
            selectedTileIds: [tileId],
            tiles: {
              ...state.tiles,
              [tileId]: {
                ...tile,
                zIndex: nextZIndex(state.tiles)
              }
            }
          };
        }),
      selectTiles: (tileIds) => set({ selectedTileIds: tileIds }),
      toggleTileSelection: (tileId) =>
        set((state) => ({
          selectedTileIds: state.selectedTileIds.includes(tileId)
            ? state.selectedTileIds.filter((id) => id !== tileId)
            : [...state.selectedTileIds, tileId]
        })),
      clearSelection: () => set({ selectedTileIds: [] }),
      centerOnTile: (tileId) =>
        set((state) => {
          const tile = state.tiles[tileId];
          if (!tile) {
            return state;
          }
          return {
            pointerWorld: {
              x: snap(tile.x + tile.width / 2),
              y: snap(tile.y + tile.height / 2)
            }
          };
        }),
      moveTile: (tileId, x, y) =>
        set((state) => {
          const tile = state.tiles[tileId];
          if (!tile) {
            return state;
          }
          return {
            tiles: {
              ...state.tiles,
              [tileId]: { ...tile, x, y }
            }
          };
        }),
      moveTiles: (tileIds, dx, dy) =>
        set((state) => ({
          tiles: Object.fromEntries(
            Object.values(state.tiles).map((tile) => [
              tile.id,
              tileIds.includes(tile.id)
                ? {
                    ...tile,
                    x: snap(tile.x + dx),
                    y: snap(tile.y + dy)
                  }
                : tile
            ])
          )
        })),
      resizeTile: (tileId, width, height) =>
        set((state) => {
          const tile = state.tiles[tileId];
          if (!tile) {
            return state;
          }
          return {
            tiles: {
              ...state.tiles,
              [tileId]: {
                ...tile,
                width: Math.max(tile.kind === "text" ? 260 : 420, width),
                height: Math.max(tile.kind === "text" ? 120 : 220, height)
              }
            }
          };
        }),
      updateBrowserUrl: (tileId, url) =>
        set((state) => {
          const tile = state.tiles[tileId];
          if (!tile || tile.kind !== "browser") {
            return state;
          }
          return {
            tiles: {
              ...state.tiles,
              [tileId]: { ...tile, url }
            }
          };
        }),
      reloadBrowserTile: (tileId) =>
        set((state) => {
          const tile = state.tiles[tileId];
          if (!tile || tile.kind !== "browser") {
            return state;
          }
          return {
            tiles: {
              ...state.tiles,
              [tileId]: {
                ...tile,
                reloadKey: tile.reloadKey + 1
              }
            }
          };
        }),
      upsertHost: (host) =>
        set((state) => ({
          hosts: state.hosts.some((candidate) => candidate.id === host.id)
            ? state.hosts.map((candidate) => (candidate.id === host.id ? host : candidate))
            : [...state.hosts, host]
        })),
      updateTextTile: (tileId, text) =>
        set((state) => {
          const tile = state.tiles[tileId];
          if (!tile || tile.kind !== "text") {
            return state;
          }
          return {
            tiles: {
              ...state.tiles,
              [tileId]: { ...tile, text }
            }
          };
        }),
      updateTextStyle: (tileId, patch) =>
        set((state) => {
          const tile = state.tiles[tileId];
          if (!tile || tile.kind !== "text") {
            return state;
          }
          return {
            tiles: {
              ...state.tiles,
              [tileId]: {
                ...tile,
                ...patch,
                fontSize: Math.max(18, Math.min(96, patch.fontSize ?? tile.fontSize))
              }
            }
          };
        }),
      updateFrameLabel: (tileId, label) =>
        set((state) => {
          const tile = state.tiles[tileId];
          if (!tile || tile.kind !== "frame") {
            return state;
          }
          return {
            tiles: {
              ...state.tiles,
              [tileId]: { ...tile, label, title: label || "Group" }
            }
          };
        }),
      createTerminalTile: (x, y, options) =>
        createTileAtPointer(createTerminal, get, set, x, y, options),
      createBrowserTile: (x, y) => createTileAtPointer(createBrowser, get, set, x, y),
      createTextTile: (x, y) => createTileAtPointer(createText, get, set, x, y),
      createFrameTile: (x, y) => createTileAtPointer(createFrame, get, set, x, y),
      copySelectedTiles: () =>
        set((state) => ({
          clipboardTiles: state.selectedTileIds
            .map((id) => state.tiles[id])
            .filter((tile): tile is ClipboardTileSnapshot => Boolean(tile))
        })),
      pasteClipboardTiles: (x, y) => {
        const state = get();
        if (!state.clipboardTiles.length) {
          return [];
        }

        const minX = Math.min(...state.clipboardTiles.map((tile) => tile.x));
        const minY = Math.min(...state.clipboardTiles.map((tile) => tile.y));
        const targetX = x ?? state.pointerWorld.x;
        const targetY = y ?? state.pointerWorld.y;
        const nextTiles = { ...state.tiles };
        const newIds: string[] = [];
        let zIndex = nextZIndex(state.tiles);

        for (const tile of state.clipboardTiles) {
          const nextTile = cloneTileForPaste(
            tile,
            snap(targetX + (tile.x - minX)),
            snap(targetY + (tile.y - minY)),
            zIndex++
          );
          nextTiles[nextTile.id] = nextTile;
          newIds.push(nextTile.id);
        }

        set({
          tiles: nextTiles,
          selectedTileIds: newIds
        });

        return newIds;
      },
      addLink: (fromTileId, toTileId) =>
        set((state) => {
          if (
            fromTileId === toTileId ||
            state.links.some(
              (link) => link.fromTileId === fromTileId && link.toTileId === toTileId
            )
          ) {
            return state;
          }
          return {
            links: [
              ...state.links,
              {
                id: makeId("link"),
                fromTileId,
                toTileId
              }
            ]
          };
        }),
      removeLink: (linkId) =>
        set((state) => ({
          links: state.links.filter((link) => link.id !== linkId)
        })),
      closeTile: (tileId) =>
        set((state) => {
          const nextTiles = { ...state.tiles };
          delete nextTiles[tileId];
          return {
            tiles: nextTiles,
            selectedTileIds: state.selectedTileIds.filter((id) => id !== tileId),
            links: state.links.filter(
              (link) => link.fromTileId !== tileId && link.toTileId !== tileId
            ),
            toasts: state.toasts.filter((toast) => toast.tileId !== tileId)
          };
        }),
      setTerminalRuntime: (tileId, runtimeSessionId, state = "live") =>
        set((current) => {
          const tile = current.tiles[tileId];
          if (!tile || tile.kind !== "terminal") {
            return current;
          }
          return {
            tiles: {
              ...current.tiles,
              [tileId]: {
                ...tile,
                runtimeSessionId,
                connectionState: state,
                attention: "idle"
              }
            }
          };
        }),
      setTerminalFailure: (tileId, message) =>
        set((state) => {
          const tile = state.tiles[tileId];
          if (!tile || tile.kind !== "terminal") {
            return state;
          }
          return {
            tiles: {
              ...state.tiles,
              [tileId]: {
                ...tile,
                runtimeSessionId: undefined,
                connectionState: "failed",
                attention: "failed",
                lastActivityAt: Date.now(),
                lastPreview: message
              }
            },
            toasts: [
              ...state.toasts.filter((toast) => toast.tileId !== tileId),
              {
                id: makeId("toast"),
                tileId,
                title: tile.title,
                message,
                tone: "danger",
                createdAt: Date.now()
              }
            ]
          };
        }),
      appendTerminalOutput: (runtimeSessionId, data) =>
        set((state) => {
          const tile = Object.values(state.tiles).find(
            (candidate) =>
              candidate.kind === "terminal" && candidate.runtimeSessionId === runtimeSessionId
          );
          if (!tile || tile.kind !== "terminal") {
            return state;
          }
          const outputBuffer = `${tile.outputBuffer}${data}`.slice(-160000);
          const needsInput =
            /(?:\?\s*$|press enter|enter to confirm|continue\?|proceed\?|y\/n|yes\/no|select an option|waiting for input)/im.test(
              data
            );
          const completed =
            /(?:completed|done\b|finished successfully|task complete|all done)/im.test(data);
          const nextAttention: TerminalAttentionState = needsInput
            ? "needs-input"
            : completed
              ? "done"
              : tile.attention;
          const nextToasts: ToastNotice[] =
            nextAttention !== "idle" && nextAttention !== tile.attention
              ? [
                  ...state.toasts.filter((toast) => toast.tileId !== tile.id),
                  {
                    id: makeId("toast"),
                    tileId: tile.id,
                    title: tile.title,
                    message:
                      nextAttention === "needs-input"
                        ? "Needs your input"
                        : "Looks complete",
                    tone: nextAttention === "needs-input" ? "warning" : "success",
                    createdAt: Date.now()
                  }
                ]
              : state.toasts;
          return {
            tiles: {
              ...state.tiles,
              [tile.id]: {
                ...tile,
                connectionState: "live",
                attention: nextAttention,
                lastActivityAt: Date.now(),
                outputBuffer,
                lastPreview: getPreview(outputBuffer)
              }
            },
            toasts: nextToasts
          };
        }),
      markTerminalExited: (runtimeSessionId) =>
        set((state) => {
          const tile = Object.values(state.tiles).find(
            (candidate) =>
              candidate.kind === "terminal" && candidate.runtimeSessionId === runtimeSessionId
          );
          if (!tile || tile.kind !== "terminal") {
            return state;
          }
          return {
            tiles: {
              ...state.tiles,
              [tile.id]: {
                ...tile,
                runtimeSessionId: undefined,
                connectionState: "disconnected",
                attention: tile.attention === "needs-input" ? "needs-input" : "done",
                lastActivityAt: Date.now(),
                lastPreview: tile.lastPreview || "Disconnected"
              }
            },
            toasts:
              tile.attention === "needs-input"
                ? state.toasts
                : ([
                    ...state.toasts.filter((toast) => toast.tileId !== tile.id),
                    {
                      id: makeId("toast"),
                      tileId: tile.id,
                      title: tile.title,
                      message: "Terminal finished",
                      tone: "success",
                      createdAt: Date.now()
                    }
                  ] satisfies ToastNotice[])
          };
        }),
      restartTerminalTile: (tileId) =>
        set((state) => {
          const tile = state.tiles[tileId];
          if (!tile || tile.kind !== "terminal") {
            return state;
          }
          return {
            tiles: {
              ...state.tiles,
              [tileId]: {
                ...tile,
                outputBuffer: "",
                runtimeSessionId: undefined,
                connectionState: "connecting",
                attention: "idle",
                lastPreview: "Connecting...",
                sessionName: makeSessionName(tile.title)
              }
            }
          };
        }),
      clearTerminalAttention: (tileId) =>
        set((state) => {
          const tile = state.tiles[tileId];
          if (!tile || tile.kind !== "terminal") {
            return state;
          }
          return {
            tiles: {
              ...state.tiles,
              [tileId]: {
                ...tile,
                attention: "idle"
              }
            },
            toasts: state.toasts.filter((toast) => toast.tileId !== tileId)
          };
        }),
      dismissToast: (toastId) =>
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== toastId)
        })),
      clearRuntimeState: () =>
        set((state) => ({
          tiles: Object.fromEntries(
            Object.values(state.tiles).map((tile) => [
              tile.id,
              tile.kind === "terminal"
                ? {
                    ...tile,
                    runtimeSessionId: undefined,
                    connectionState: "connecting",
                    attention: "idle",
                    lastPreview: tile.outputBuffer ? getPreview(tile.outputBuffer) : "Connecting..."
                  }
                : tile
            ])
          )
        })),
      remapWorld: (deltaX, deltaY) =>
        set((state) => ({
          pointerWorld: {
            x: snap(Math.max(0, state.pointerWorld.x + deltaX)),
            y: snap(Math.max(0, state.pointerWorld.y + deltaY))
          },
          tiles: Object.fromEntries(
            Object.values(state.tiles).map((tile) => [
              tile.id,
              {
                ...tile,
                x: snap(Math.max(0, tile.x + deltaX)),
                y: snap(Math.max(0, tile.y + deltaY))
              }
            ])
          )
        }))
    }),
    {
      name: "agent-deck-canvas-v2",
      partialize: (state) => ({
        viewport: state.viewport,
        pointerWorld: state.pointerWorld,
        hosts: state.hosts,
        links: state.links,
        selectedTileIds: state.selectedTileIds,
        tiles: Object.fromEntries(
          Object.values(state.tiles).map((tile) => [
            tile.id,
            tile.kind === "terminal"
              ? {
                  ...tile,
                  runtimeSessionId: undefined,
                  connectionState: "disconnected",
                  attention: "idle"
                }
              : tile
          ])
        )
      })
    }
  )
);
