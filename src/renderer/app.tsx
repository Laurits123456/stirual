import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AppWindow,
  ExternalLink,
  Globe,
  Grip,
  Link2,
  Laptop,
  Minus,
  Plus,
  Server,
  Sparkles,
  SquareTerminal,
  Type,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { TerminalPane } from "@/renderer/components/terminal-pane";
import { Button } from "@/renderer/components/ui/button";
import { useRuntime } from "@/renderer/runtime";
import type { HostConfig } from "@/main/session-manager";
import {
  type BrowserTile,
  type CanvasTile,
  DEFAULT_HOSTS,
  LOCAL_HOST,
  type TerminalTile,
  type TextTile,
  useDeckStore
} from "@/renderer/store";

const WORLD_SIZE = 12000;
const WORLD_CENTER = WORLD_SIZE / 2;
const TEXT_SWATCHES = ["#f4f1ea", "#f8d38f", "#b7f0d5", "#9cc8ff", "#f8a6b8"];

function snap(value: number) {
  return Math.round(value / 4) * 4;
}

function clampZoom(zoom: number) {
  return Math.max(0.2, Math.min(1.75, zoom));
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest("input, textarea, [contenteditable='true'], webview"));
}

function normalizeBrowserUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "about:blank";
  if (/^[a-zA-Z]+:\/\//.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function safeBrowserUrl(url: string) {
  const normalized = normalizeBrowserUrl(url);
  if (normalized === "about:blank") {
    return normalized;
  }
  try {
    return new URL(normalized).toString();
  } catch {
    return "about:blank";
  }
}

function ToolbarButton({
  icon,
  label,
  shortcut,
  onClick
}: {
  icon: ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/7 bg-white/[0.025] px-3 text-[12px] text-foreground/92 transition hover:bg-white/[0.055]"
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{label}</span>
      {shortcut ? (
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {shortcut}
        </span>
      ) : null}
    </button>
  );
}

function TerminalTileView({ tile }: { tile: TerminalTile }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit] bg-[#0b0d10]">
      <div className="min-h-0 flex-1">
        <TerminalPane tileId={tile.id} />
      </div>
    </div>
  );
}

function BrowserTileView({
  tile,
  isSelected
}: {
  tile: BrowserTile;
  isSelected: boolean;
}) {
  const updateBrowserUrl = useDeckStore((state) => state.updateBrowserUrl);
  const reloadBrowserTile = useDeckStore((state) => state.reloadBrowserTile);
  const normalizedUrl = useMemo(() => {
    return safeBrowserUrl(tile.url);
  }, [tile.url]);
  const [draftUrl, setDraftUrl] = useState(tile.url === "about:blank" ? "https://" : tile.url);
  const [currentUrl, setCurrentUrl] = useState(tile.url);
  const webviewRef = useRef<any>(null);

  useEffect(() => {
    setDraftUrl(tile.url === "about:blank" ? "https://" : tile.url);
    setCurrentUrl(tile.url);
  }, [tile.url, tile.id]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }

    const syncUrl = () => {
      try {
        const url = webview.getURL?.() || tile.url;
        if (url) {
          setCurrentUrl(url);
          setDraftUrl(url);
        }
      } catch {
        // Ignore webview timing errors.
      }
    };

    webview.addEventListener("did-navigate", syncUrl);
    webview.addEventListener("did-navigate-in-page", syncUrl);

    return () => {
      webview.removeEventListener("did-navigate", syncUrl);
      webview.removeEventListener("did-navigate-in-page", syncUrl);
    };
  }, [tile.id, tile.url, tile.reloadKey]);

  function commitUrl() {
    updateBrowserUrl(tile.id, safeBrowserUrl(draftUrl));
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit] bg-[#0b0d10]">
      {isSelected ? (
        <div className="flex h-9 items-center gap-1 border-b border-white/6 bg-[#0c0f13] px-2">
          <button
            className="inline-flex size-7 items-center justify-center rounded-md text-[11px] text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground"
            onClick={() => webviewRef.current?.goBack?.()}
            title="Back"
            type="button"
          >
            ←
          </button>
          <button
            className="inline-flex size-7 items-center justify-center rounded-md text-[11px] text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground"
            onClick={() => webviewRef.current?.goForward?.()}
            title="Forward"
            type="button"
          >
            →
          </button>
          <button
            className="inline-flex size-7 items-center justify-center rounded-md text-[11px] text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground"
            onClick={() => webviewRef.current?.reload?.()}
            title="Reload"
            type="button"
          >
            ↻
          </button>
          <button
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground"
            onClick={() => {
              const url = safeBrowserUrl(currentUrl || draftUrl);
              if (url !== "about:blank") {
                void window.deck.openExternal(url);
              }
            }}
            title="Open in browser"
            type="button"
          >
            <ExternalLink className="size-3.5" />
          </button>
          <input
            className="h-7 min-w-0 flex-1 rounded-md border border-white/8 bg-white/[0.03] px-2.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
            onChange={(event) => setDraftUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitUrl();
              }
            }}
            placeholder="https://"
            value={draftUrl}
          />
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <div className="relative h-full overflow-hidden bg-white">
          {normalizedUrl === "about:blank" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_40%)]">
              <div className="text-center">
                <Globe className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-3 text-[12px] font-medium">Browser tile</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Open a URL to load a real embedded browser surface.
                </p>
                <button
                  className="mt-4 inline-flex h-8 items-center justify-center rounded-md border border-black/10 bg-black px-3 text-[12px] font-medium text-white transition hover:bg-black/85"
                  onClick={() => updateBrowserUrl(tile.id, safeBrowserUrl(draftUrl))}
                  type="button"
                >
                  Open URL
                </button>
                <button
                  className="mt-4 ml-2 inline-flex h-8 items-center justify-center rounded-md border border-black/10 bg-white px-3 text-[12px] font-medium text-black transition hover:bg-black/5"
                  onClick={() => reloadBrowserTile(tile.id)}
                  type="button"
                >
                  Reload
                </button>
              </div>
            </div>
          ) : (
            <webview
              key={`${tile.id}:${tile.reloadKey}`}
              className="size-full bg-white"
              partition="persist:agent-deck-browser"
              ref={webviewRef}
              src={normalizedUrl}
              webpreferences="contextIsolation=yes"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TextTileView({ tile }: { tile: TextTile }) {
  const updateTextTile = useDeckStore((state) => state.updateTextTile);

  return (
    <textarea
      className="size-full resize-none border-0 bg-transparent px-1 py-0.5 font-['Caveat','Segoe_Print','Bradley_Hand',cursive] leading-[1.18] outline-none placeholder:text-white/24"
      onChange={(event) => updateTextTile(tile.id, event.target.value)}
      placeholder="Write something..."
      style={{ color: tile.color, fontSize: `${tile.fontSize}px` }}
      value={tile.text}
    />
  );
}

function CanvasTileShell({
  tile,
  onStartLink,
  screenScale
}: {
  tile: CanvasTile;
  onStartLink: (tileId: string, clientX: number, clientY: number) => void;
  screenScale: number;
}) {
  const selectedTileIds = useDeckStore((state) => state.selectedTileIds);
  const focusTile = useDeckStore((state) => state.focusTile);
  const toggleTileSelection = useDeckStore((state) => state.toggleTileSelection);
  const moveTile = useDeckStore((state) => state.moveTile);
  const moveTiles = useDeckStore((state) => state.moveTiles);
  const resizeTile = useDeckStore((state) => state.resizeTile);
  const updateTextStyle = useDeckStore((state) => state.updateTextStyle);
  const { closeTile } = useRuntime();
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    initialSelection: string[];
  } | null>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    originWidth: number;
    originHeight: number;
  } | null>(null);

  const isSelected = selectedTileIds.includes(tile.id);
  const icon =
    tile.kind === "terminal" ? (
      <SquareTerminal className="size-3.5" />
    ) : tile.kind === "browser" ? (
      <Globe className="size-3.5" />
    ) : (
      <Type className="size-3.5" />
    );

  function selectFromPointer(event: React.PointerEvent) {
    if (event.metaKey || event.ctrlKey) {
      toggleTileSelection(tile.id);
      return;
    }
    if (!isSelected) {
      focusTile(tile.id);
    }
  }

  function handleDragStart(event: React.PointerEvent<HTMLElement>) {
    if (isEditableTarget(event.target)) {
      return;
    }
    if (event.ctrlKey) {
      focusTile(tile.id);
      onStartLink(tile.id, event.clientX, event.clientY);
      event.stopPropagation();
      return;
    }
    selectFromPointer(event);
    const selection = useDeckStore.getState().selectedTileIds;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: tile.x,
      originY: tile.y,
      initialSelection: selection.includes(tile.id) ? selection : [tile.id]
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
  }

  function handleDragMove(event: React.PointerEvent<HTMLElement>) {
    if (!dragRef.current) {
      return;
    }
    const dx = snap((event.clientX - dragRef.current.startX) / Math.max(screenScale, 0.001));
    const dy = snap((event.clientY - dragRef.current.startY) / Math.max(screenScale, 0.001));
    if (dragRef.current.initialSelection.length > 1) {
      moveTiles(dragRef.current.initialSelection, dx, dy);
      dragRef.current = {
        ...dragRef.current,
        startX: event.clientX,
        startY: event.clientY
      };
      return;
    }
    moveTile(tile.id, snap(dragRef.current.originX + dx), snap(dragRef.current.originY + dy));
  }

  function handleResizeStart(event: React.PointerEvent<HTMLButtonElement>) {
    focusTile(tile.id);
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originWidth: tile.width,
      originHeight: tile.height
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
  }

  function handleResizeMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!resizeRef.current || (event.buttons & 1) !== 1) return;
    resizeTile(
      tile.id,
      snap(
        resizeRef.current.originWidth +
          (event.clientX - resizeRef.current.startX) / Math.max(screenScale, 0.001)
      ),
      snap(
        resizeRef.current.originHeight +
          (event.clientY - resizeRef.current.startY) / Math.max(screenScale, 0.001)
      )
    );
  }

  function handleResizeEnd(event?: React.PointerEvent<HTMLButtonElement>) {
    resizeRef.current = null;
    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  if (tile.kind === "text") {
    return (
      <div
        className={`absolute overflow-visible transition-shadow ${
          isSelected ? "ring-1 ring-white/18" : ""
        }`}
        onPointerDown={selectFromPointer}
        style={{
          left: tile.x * screenScale,
          top: tile.y * screenScale,
          width: tile.width * screenScale,
          height: tile.height * screenScale,
          zIndex: tile.zIndex
        }}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            width: tile.width,
            height: tile.height,
            transform: `scale(${screenScale})`,
            transformOrigin: "top left"
          }}
        >
          <div
            className="absolute -left-1 -top-7 flex items-center gap-1"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={() => {
              dragRef.current = null;
            }}
          >
            {isSelected ? (
              <>
                <button
                  className="inline-flex h-6 items-center gap-1 rounded-md border border-white/10 bg-[#12161c]/92 px-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                  type="button"
                >
                  <Type className="size-3" />
                  Text
                </button>
                <button
                  className="inline-flex size-6 items-center justify-center rounded-md border border-white/10 bg-[#12161c]/92 text-muted-foreground hover:text-foreground"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    void closeTile(tile.id);
                  }}
                  type="button"
                >
                  <X className="size-3.5" />
                </button>
                <div className="ml-1 flex items-center gap-1 rounded-md border border-white/10 bg-[#12161c]/92 px-1 py-1">
                  <button
                    className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      updateTextStyle(tile.id, { fontSize: tile.fontSize - 2 });
                    }}
                    type="button"
                  >
                    <Minus className="size-3" />
                  </button>
                  <div className="w-8 text-center text-[10px] text-muted-foreground">
                    {tile.fontSize}
                  </div>
                  <button
                    className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      updateTextStyle(tile.id, { fontSize: tile.fontSize + 2 });
                    }}
                    type="button"
                  >
                    <Plus className="size-3" />
                  </button>
                  <div className="ml-1 flex items-center gap-1">
                    {TEXT_SWATCHES.map((color) => (
                      <button
                        key={color}
                        className={`size-4 rounded-full border ${
                          tile.color === color ? "border-white/70" : "border-white/10"
                        }`}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          updateTextStyle(tile.id, { color });
                        }}
                        style={{ backgroundColor: color }}
                        type="button"
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
          <div className="size-full">
            <TextTileView tile={tile} />
          </div>
          {isSelected ? (
            <button
              className="absolute -bottom-2 -right-2 inline-flex size-6 items-center justify-center rounded-md border border-white/10 bg-[#12161c]/92 text-muted-foreground hover:text-foreground"
              onPointerDown={handleResizeStart}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
              onPointerCancel={handleResizeEnd}
              onLostPointerCapture={() => {
                resizeRef.current = null;
              }}
              type="button"
            >
              <Grip className="size-3.5 rotate-45" />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`absolute overflow-hidden rounded-[7px] border bg-[#101318]/98 shadow-[0_12px_28px_rgba(0,0,0,0.26)] transition-shadow ${
        isSelected
          ? "border-white/18 shadow-[0_18px_44px_rgba(0,0,0,0.32)]"
          : "border-white/7"
      }`}
      onPointerDown={selectFromPointer}
      style={{
        left: tile.x * screenScale,
        top: tile.y * screenScale,
        width: tile.width * screenScale,
        height: tile.height * screenScale,
        zIndex: tile.zIndex
      }}
    >
      <div
        className="flex h-full flex-col"
        style={{
          width: tile.width,
          height: tile.height,
          transform: `scale(${screenScale})`,
          transformOrigin: "top left"
        }}
      >
          <div
            className="flex h-8 items-center justify-between border-b border-white/6 bg-white/[0.02] px-2.5 text-left hover:bg-white/[0.032]"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={() => {
              dragRef.current = null;
            }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-muted-foreground">{icon}</span>
              <span className="truncate text-[12px] font-medium text-foreground/95">{tile.title}</span>
              {tile.kind === "terminal" && tile.attention !== "idle" ? (
                <span
                  className={`inline-flex size-2 rounded-full ${
                    tile.attention === "needs-input"
                      ? "animate-pulse bg-amber-400"
                      : tile.attention === "failed"
                        ? "animate-pulse bg-rose-400"
                        : "animate-pulse bg-emerald-400"
                  }`}
                />
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              {tile.kind === "browser" ? (
                <button
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  title="Browser"
                  type="button"
                >
                  <Globe className="size-3.5" />
                </button>
              ) : null}
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {tile.kind}
              </span>
              <button
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  void closeTile(tile.id);
                }}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1">
          {tile.kind === "browser" ? (
            <BrowserTileView isSelected={isSelected} tile={tile} />
          ) : tile.kind === "terminal" ? (
            <TerminalTileView tile={tile} />
          ) : null}
          </div>
          <button
            className="absolute bottom-0.5 right-0.5 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            onLostPointerCapture={() => {
              resizeRef.current = null;
            }}
            type="button"
          >
            <Grip className="size-3.5 rotate-45" />
          </button>
        </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="max-w-md text-center">
        <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
          Canvas workspace
        </p>
        <h2 className="mt-4 text-[28px] font-semibold tracking-tight text-foreground/94">
          Drop terminals, browsers, and notes into space
        </h2>
        <p className="mt-4 text-[13px] leading-7 text-muted-foreground">
          Press <span className="text-foreground">Ctrl+T</span> for a terminal,
          <span className="text-foreground"> Ctrl+B</span> for a browser, and
          <span className="text-foreground"> Ctrl+P</span> for a paragraph.
        </p>
      </div>
    </div>
  );
}

type Marquee = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type ViewportMetrics = {
  width: number;
  height: number;
  scrollLeft: number;
  scrollTop: number;
};

export default function App() {
  const version = useDeckStore((state) => state.version);
  const viewport = useDeckStore((state) => state.viewport);
  const hosts = useDeckStore((state) => state.hosts);
  const tiles = useDeckStore((state) => state.tiles);
  const links = useDeckStore((state) => state.links);
  const toasts = useDeckStore((state) => state.toasts);
  const selectedTileIds = useDeckStore((state) => state.selectedTileIds);
  const setVersion = useDeckStore((state) => state.setVersion);
  const setPointerWorld = useDeckStore((state) => state.setPointerWorld);
  const setViewportZoom = useDeckStore((state) => state.setViewportZoom);
  const createTerminalTile = useDeckStore((state) => state.createTerminalTile);
  const createBrowserTile = useDeckStore((state) => state.createBrowserTile);
  const createTextTile = useDeckStore((state) => state.createTextTile);
  const copySelectedTiles = useDeckStore((state) => state.copySelectedTiles);
  const pasteClipboardTiles = useDeckStore((state) => state.pasteClipboardTiles);
  const reloadBrowserTile = useDeckStore((state) => state.reloadBrowserTile);
  const remapWorld = useDeckStore((state) => state.remapWorld);
  const addLink = useDeckStore((state) => state.addLink);
  const dismissToast = useDeckStore((state) => state.dismissToast);
  const clearTerminalAttention = useDeckStore((state) => state.clearTerminalAttention);
  const upsertHost = useDeckStore((state) => state.upsertHost);
  const selectTiles = useDeckStore((state) => state.selectTiles);
  const clearSelection = useDeckStore((state) => state.clearSelection);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const initializedScrollRef = useRef(false);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandStep, setCommandStep] = useState<1 | 2>(1);
  const [draftHost, setDraftHost] = useState<HostConfig>(LOCAL_HOST);
  const [draftPreset, setDraftPreset] = useState<"claude" | "claude-resume" | "codex" | "codex-resume" | "shell" | "custom">("shell");
  const [draftCommand, setDraftCommand] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCwd, setDraftCwd] = useState("");
  const [linkDraft, setLinkDraft] = useState<{ fromTileId: string; toX: number; toY: number } | null>(null);
  const [attentionIndex, setAttentionIndex] = useState(0);
  const [attentionModalOpen, setAttentionModalOpen] = useState(false);
  const [minimapVisible, setMinimapVisible] = useState(true);
  const [viewportMetrics, setViewportMetrics] = useState<ViewportMetrics>({
    width: 0,
    height: 0,
    scrollLeft: 0,
    scrollTop: 0
  });
  const panRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const minimapDragRef = useRef(false);
  const pendingZoomAnchorRef = useRef<{
    nextZoom: number;
    worldX: number;
    worldY: number;
    anchorX: number;
    anchorY: number;
  } | null>(null);

  useEffect(() => {
    void window.deck.getVersion().then(setVersion);
  }, [setVersion]);

  useEffect(() => {
    const viewportEl = viewportRef.current;
    if (!viewportEl || initializedScrollRef.current) {
      return;
    }
    viewportEl.scrollLeft = WORLD_CENTER * viewport.zoom - viewportEl.clientWidth / 2;
    viewportEl.scrollTop = WORLD_CENTER * viewport.zoom - viewportEl.clientHeight / 2;
    initializedScrollRef.current = true;
  }, [viewport.zoom]);

  useEffect(() => {
    const allTiles = Object.values(tiles);
    if (allTiles.length === 0) {
      return;
    }
    const maxX = Math.max(...allTiles.map((tile) => tile.x + tile.width));
    const maxY = Math.max(...allTiles.map((tile) => tile.y + tile.height));
    const looksLikeOldWorld =
      maxX > WORLD_SIZE + 400 || maxY > WORLD_SIZE + 400;
    if (!looksLikeOldWorld) {
      return;
    }
    remapWorld(-WORLD_CENTER, -WORLD_CENTER);
  }, [tiles, remapWorld]);

  useEffect(() => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) {
      return;
    }

    const syncViewportMetrics = () => {
      setViewportMetrics({
        width: viewportEl.clientWidth,
        height: viewportEl.clientHeight,
        scrollLeft: viewportEl.scrollLeft,
        scrollTop: viewportEl.scrollTop
      });
    };

    syncViewportMetrics();
    viewportEl.addEventListener("scroll", syncViewportMetrics, { passive: true });
    const observer = new ResizeObserver(syncViewportMetrics);
    observer.observe(viewportEl);

    return () => {
      viewportEl.removeEventListener("scroll", syncViewportMetrics);
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const viewportEl = viewportRef.current;
    const pendingZoom = pendingZoomAnchorRef.current;
    if (!viewportEl || !pendingZoom) {
      return;
    }
    if (Math.abs(viewport.zoom - pendingZoom.nextZoom) > 0.0001) {
      return;
    }

    viewportEl.scrollLeft = Math.max(0, pendingZoom.worldX * viewport.zoom - pendingZoom.anchorX);
    viewportEl.scrollTop = Math.max(0, pendingZoom.worldY * viewport.zoom - pendingZoom.anchorY);
    pendingZoomAnchorRef.current = null;
  }, [viewport.zoom]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const editable = isEditableTarget(event.target);
      if (event.key === " " && !editable) {
        setSpacePressed(true);
      }
      if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (editable) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "t") {
        event.preventDefault();
        createTerminalTile();
      } else if (key === "b") {
        event.preventDefault();
        createBrowserTile();
      } else if (key === "p") {
        event.preventDefault();
        createTextTile();
      } else if (key === "c") {
        event.preventDefault();
        copySelectedTiles();
      } else if (key === "v") {
        event.preventDefault();
        pasteClipboardTiles();
      } else if (key === "e") {
        event.preventDefault();
        setCommandOpen(true);
        setCommandStep(1);
      } else if (key === "r") {
        event.preventDefault();
        const selectedBrowser = useDeckStore
          .getState()
          .selectedTileIds.map((id) => useDeckStore.getState().tiles[id])
          .find((tile): tile is BrowserTile => Boolean(tile && tile.kind === "browser"));
        if (selectedBrowser) {
          reloadBrowserTile(selectedBrowser.id);
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === " ") {
        setSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    copySelectedTiles,
    createBrowserTile,
    createTerminalTile,
    createTextTile,
    pasteClipboardTiles,
    reloadBrowserTile
  ]);

  const sortedTiles = useMemo(
    () => Object.values(tiles).sort((left, right) => left.zIndex - right.zIndex),
    [tiles]
  );
  const attentionQueue = useMemo(
    () =>
      Object.values(tiles)
        .filter((tile): tile is TerminalTile => tile.kind === "terminal" && tile.attention !== "idle")
        .sort((left, right) => (right.lastActivityAt || 0) - (left.lastActivityAt || 0)),
    [tiles]
  );
  const activeAttentionTile =
    attentionQueue.length > 0 ? attentionQueue[Math.min(attentionIndex, attentionQueue.length - 1)] : null;

  useEffect(() => {
    if (attentionQueue.length === 0) {
      setAttentionIndex(0);
      setAttentionModalOpen(false);
      return;
    }
    if (attentionIndex > attentionQueue.length - 1) {
      setAttentionIndex(attentionQueue.length - 1);
    }
  }, [attentionIndex, attentionQueue]);

  useEffect(() => {
    if (attentionQueue.length > 0) {
      setAttentionModalOpen(true);
    }
  }, [attentionQueue.length]);

  function attentionTone(tile: TerminalTile) {
    if (tile.attention === "needs-input") return "warning";
    if (tile.attention === "failed") return "danger";
    return "success";
  }

  function attentionTitle(tile: TerminalTile) {
    if (tile.attention === "needs-input") return "Needs input";
    if (tile.attention === "failed") return "Failed";
    return "Done";
  }

  function centerViewportOnTile(tileId: string) {
    const tile = tiles[tileId];
    const viewportEl = viewportRef.current;
    if (!tile || !viewportEl) {
      return;
    }
    viewportEl.scrollTo({
      left: Math.max(0, (tile.x + tile.width / 2) * viewport.zoom - viewportEl.clientWidth / 2),
      top: Math.max(0, (tile.y + tile.height / 2) * viewport.zoom - viewportEl.clientHeight / 2),
      behavior: "smooth"
    });
    selectTiles([tileId]);
    if (tile.kind === "terminal") {
      clearTerminalAttention(tileId);
    }
  }

  function submitCommandCreation() {
    const host = draftHost.kind === "ssh" && draftHost.address
      ? {
          ...draftHost,
          name: draftHost.name || `${draftHost.username || "root"}@${draftHost.address}`
        }
      : draftHost;
    if (host.kind === "ssh") {
      upsertHost(host);
    }
    createTerminalTile(undefined, undefined, {
      host,
      preset: draftPreset,
      command: draftPreset === "custom" ? draftCommand.trim() : undefined,
      title:
        draftTitle.trim() ||
        (draftPreset === "shell"
          ? host.kind === "local"
            ? "Terminal"
            : `SSH ${host.name}`
          : draftPreset === "claude"
            ? "Claude"
            : draftPreset === "claude-resume"
              ? "Claude Resume"
              : draftPreset === "codex"
                ? "Codex"
                : draftPreset === "codex-resume"
                  ? "Codex Resume"
                  : "Command"),
      cwd: draftCwd.trim() || undefined
    });
    setCommandOpen(false);
    setCommandStep(1);
    setDraftPreset("shell");
    setDraftCommand("");
    setDraftTitle("");
    setDraftCwd("");
    setDraftHost(LOCAL_HOST);
  }

  function screenToWorld(clientX: number, clientY: number) {
    const viewportEl = viewportRef.current;
    if (!viewportEl) {
      return { x: 0, y: 0 };
    }
    const rect = viewportEl.getBoundingClientRect();
    return {
      x: snap((viewportEl.scrollLeft + clientX - rect.left) / viewport.zoom),
      y: snap((viewportEl.scrollTop + clientY - rect.top) / viewport.zoom)
    };
  }

  function updatePointerWorld(event: React.MouseEvent<HTMLDivElement>) {
    const world = screenToWorld(event.clientX, event.clientY);
    setPointerWorld(world.x, world.y);
  }

  function startPan(event: React.PointerEvent<HTMLDivElement>) {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;
    event.preventDefault();
    panRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewportEl.scrollLeft,
      scrollTop: viewportEl.scrollTop
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updatePan(event: React.PointerEvent<HTMLDivElement>) {
    const viewportEl = viewportRef.current;
    if (!viewportEl || !panRef.current) return;
    viewportEl.scrollLeft = panRef.current.scrollLeft - (event.clientX - panRef.current.startX);
    viewportEl.scrollTop = panRef.current.scrollTop - (event.clientY - panRef.current.startY);
  }

  function stopPan(pointerId?: number, element?: HTMLDivElement) {
    panRef.current = null;
    if (pointerId !== undefined && element?.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  }

  function finishMarquee() {
    if (!marquee) return;
    const x = Math.min(marquee.startX, marquee.currentX);
    const y = Math.min(marquee.startY, marquee.currentY);
    const width = Math.abs(marquee.currentX - marquee.startX);
    const height = Math.abs(marquee.currentY - marquee.startY);
    const selected = sortedTiles
      .filter((tile) =>
        tile.x < x + width &&
        tile.x + tile.width > x &&
        tile.y < y + height &&
        tile.y + tile.height > y
      )
      .map((tile) => tile.id);
    selectTiles(selected);
    setMarquee(null);
  }

  function setZoomAnchored(nextZoom: number, clientX?: number, clientY?: number) {
    const viewportEl = viewportRef.current;
    if (!viewportEl) {
      setViewportZoom(nextZoom);
      return;
    }

    const rect = viewportEl.getBoundingClientRect();
    const anchorX = clientX !== undefined ? clientX - rect.left : rect.width / 2;
    const anchorY = clientY !== undefined ? clientY - rect.top : rect.height / 2;
    const worldX = (viewportEl.scrollLeft + anchorX) / viewport.zoom;
    const worldY = (viewportEl.scrollTop + anchorY) / viewport.zoom;
    if (Math.abs(nextZoom - viewport.zoom) < 0.0001) {
      return;
    }

    pendingZoomAnchorRef.current = {
      nextZoom,
      worldX,
      worldY,
      anchorX,
      anchorY
    };
    setViewportZoom(nextZoom);
  }

  function nudgeZoom(direction: "in" | "out") {
    const factor = direction === "in" ? 1.08 : 1 / 1.08;
    setZoomAnchored(clampZoom(viewport.zoom * factor));
  }

  function startLink(tileId: string, clientX: number, clientY: number) {
    const world = screenToWorld(clientX, clientY);
    setLinkDraft({
      fromTileId: tileId,
      toX: world.x,
      toY: world.y
    });
  }

  const minimap = useMemo(() => {
    const width = 220;
    const height = 150;
    const viewportWorldWidth = viewportMetrics.width / Math.max(viewport.zoom, 0.001);
    const viewportWorldHeight = viewportMetrics.height / Math.max(viewport.zoom, 0.001);
    const minX = 0;
    const minY = 0;
    const worldWidth = WORLD_SIZE;
    const worldHeight = WORLD_SIZE;
    const scale = Math.min(width / worldWidth, height / worldHeight);
    return {
      width,
      height,
      scale,
      minX,
      minY,
      viewportRect: {
        left: (viewportMetrics.scrollLeft / Math.max(viewport.zoom, 0.001) - minX) * scale,
        top: (viewportMetrics.scrollTop / Math.max(viewport.zoom, 0.001) - minY) * scale,
        width: Math.max(18, viewportWorldWidth * scale),
        height: Math.max(18, viewportWorldHeight * scale)
      }
    };
  }, [viewport.zoom, viewportMetrics]);

  function moveViewportFromMinimap(clientX: number, clientY: number, element: HTMLDivElement) {
    const viewportEl = viewportRef.current;
    if (!viewportEl) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const localX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const localY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const worldX = minimap.minX + localX / minimap.scale;
    const worldY = minimap.minY + localY / minimap.scale;
    const nextScrollLeft = Math.max(0, worldX * viewport.zoom - viewportEl.clientWidth / 2);
    const nextScrollTop = Math.max(0, worldY * viewport.zoom - viewportEl.clientHeight / 2);
    viewportEl.scrollLeft = Math.min(nextScrollLeft, viewportEl.scrollWidth - viewportEl.clientWidth);
    viewportEl.scrollTop = Math.min(nextScrollTop, viewportEl.scrollHeight - viewportEl.clientHeight);
  }

  return (
    <div className="relative flex h-screen flex-col bg-[#090b0f] text-foreground">
      <header className="flex h-11 items-center justify-between border-b border-white/7 bg-[#0d1014]/96 px-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2">
              <img alt="STIRUAL" className="size-4 rounded-sm" src="/stirual-mark.svg" />
              <span className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                STIRUAL
              </span>
          </div>
          <div className="h-4 w-px bg-white/8" />
          <div className="flex items-center gap-2">
            <ToolbarButton
              icon={<SquareTerminal className="size-3.5" />}
              label="Terminal"
              onClick={() => createTerminalTile()}
              shortcut="Ctrl+T"
            />
            <ToolbarButton
              icon={<Sparkles className="size-3.5" />}
              label="Command"
              onClick={() => {
                setCommandOpen(true);
                setCommandStep(1);
              }}
              shortcut="Ctrl+E"
            />
            <ToolbarButton
              icon={<Globe className="size-3.5" />}
              label="Browser"
              onClick={() => createBrowserTile()}
              shortcut="Ctrl+B"
            />
            <ToolbarButton
              icon={<Type className="size-3.5" />}
              label="Paragraph"
              onClick={() => createTextTile()}
              shortcut="Ctrl+P"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pr-1">
          <Button
            className="size-8 rounded-lg"
            onClick={() => nudgeZoom("out")}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ZoomOut className="size-4" />
          </Button>
          <div className="w-14 text-center text-[11px] text-muted-foreground">
            {Math.round(viewport.zoom * 100)}%
          </div>
          <Button
            className="size-8 rounded-lg"
            onClick={() => nudgeZoom("in")}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ZoomIn className="size-4" />
          </Button>
          <div className="text-[11px] text-muted-foreground">{`v${version} - ${sortedTiles.length} tiles - ${selectedTileIds.length} selected`}</div>
          <button
            className="inline-flex h-7 items-center rounded-md border border-white/8 px-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition hover:bg-white/[0.04] hover:text-foreground"
            onClick={() => setMinimapVisible((current) => !current)}
            type="button"
          >
            {minimapVisible ? "Hide minimap" : "Show minimap"}
          </button>
        </div>
      </header>

      <div
        className={`agent-canvas-viewport relative min-h-0 flex-1 overflow-auto ${
          spacePressed ? "cursor-grab" : ""
        }`}
        onMouseMove={updatePointerWorld}
        onWheel={(event) => {
          if (!event.ctrlKey) return;
          event.preventDefault();
          event.stopPropagation();
          const factor = Math.exp(-event.deltaY * 0.0012);
          const nextZoom = clampZoom(viewport.zoom * factor);
          if (Math.abs(nextZoom - viewport.zoom) < 0.0001) {
            return;
          }
          setZoomAnchored(nextZoom, event.clientX, event.clientY);
        }}
        ref={viewportRef}
      >
        <div
          className="relative"
          style={{
            width: WORLD_SIZE * viewport.zoom,
            height: WORLD_SIZE * viewport.zoom
          }}
        >
          <div
            className="agent-canvas-grid absolute left-0 top-0 origin-top-left"
            onPointerDown={(event) => {
              if (event.button === 1 || spacePressed) {
                startPan(event);
                return;
              }
              if (event.target !== event.currentTarget) {
                return;
              }
              const world = screenToWorld(event.clientX, event.clientY);
              clearSelection();
              setMarquee({
                startX: world.x,
                startY: world.y,
                currentX: world.x,
                currentY: world.y
              });
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (linkDraft) {
                const world = screenToWorld(event.clientX, event.clientY);
                setLinkDraft((current) =>
                  current
                    ? {
                        ...current,
                        toX: world.x,
                        toY: world.y
                      }
                    : current
                );
                return;
              }
              if (panRef.current) {
                updatePan(event);
                return;
              }
              if (!marquee) return;
              const world = screenToWorld(event.clientX, event.clientY);
              setMarquee((current) =>
                current
                  ? {
                      ...current,
                      currentX: world.x,
                      currentY: world.y
                    }
                  : current
              );
            }}
            onPointerUp={() => {
              stopPan();
              setLinkDraft(null);
              finishMarquee();
            }}
            onPointerCancel={(event) => {
              stopPan(event.pointerId, event.currentTarget);
              setLinkDraft(null);
              setMarquee(null);
            }}
            style={{
              width: WORLD_SIZE * viewport.zoom,
              height: WORLD_SIZE * viewport.zoom
            }}
          >
            <svg className="pointer-events-none absolute inset-0 overflow-visible">
              {links.map((link) => {
                const from = tiles[link.fromTileId];
                const to = tiles[link.toTileId];
                if (!from || !to) return null;
                const x1 = from.x + from.width / 2;
                const y1 = from.y + from.height / 2;
                const x2 = to.x + to.width / 2;
                const y2 = to.y + to.height / 2;
                return (
                  <path
                    key={link.id}
                    d={`M ${x1 * viewport.zoom} ${y1 * viewport.zoom} C ${(x1 + 80) * viewport.zoom} ${y1 * viewport.zoom}, ${(x2 - 80) * viewport.zoom} ${y2 * viewport.zoom}, ${x2 * viewport.zoom} ${y2 * viewport.zoom}`}
                    fill="none"
                    stroke="rgba(148,163,184,0.75)"
                    strokeWidth="2"
                  />
                );
              })}
              {linkDraft && tiles[linkDraft.fromTileId] ? (() => {
                const from = tiles[linkDraft.fromTileId]!;
                const x1 = from.x + from.width / 2;
                const y1 = from.y + from.height / 2;
                return (
                  <path
                    d={`M ${x1 * viewport.zoom} ${y1 * viewport.zoom} C ${(x1 + 80) * viewport.zoom} ${y1 * viewport.zoom}, ${(linkDraft.toX - 80) * viewport.zoom} ${linkDraft.toY * viewport.zoom}, ${linkDraft.toX * viewport.zoom} ${linkDraft.toY * viewport.zoom}`}
                    fill="none"
                    stroke="rgba(125,211,252,0.9)"
                    strokeDasharray="6 6"
                    strokeWidth="2"
                  />
                );
              })() : null}
            </svg>
            {sortedTiles.length === 0 ? <EmptyState /> : null}
            {sortedTiles.map((tile) => (
              <div
                key={tile.id}
                onPointerUp={() => {
                  if (linkDraft && linkDraft.fromTileId !== tile.id) {
                    addLink(linkDraft.fromTileId, tile.id);
                    setLinkDraft(null);
                  }
                }}
              >
                <CanvasTileShell onStartLink={startLink} screenScale={viewport.zoom} tile={tile} />
              </div>
            ))}
            {marquee ? (
              <div
                className="pointer-events-none absolute border border-sky-300/40 bg-sky-300/10"
                style={{
                  left: Math.min(marquee.startX, marquee.currentX) * viewport.zoom,
                  top: Math.min(marquee.startY, marquee.currentY) * viewport.zoom,
                  width: Math.abs(marquee.currentX - marquee.startX) * viewport.zoom,
                  height: Math.abs(marquee.currentY - marquee.startY) * viewport.zoom,
                  zIndex: 999999
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute right-4 top-[52px] z-[1000000] flex flex-col items-end gap-2">
        {minimapVisible ? (
        <div
          className="pointer-events-auto relative overflow-hidden rounded-[10px] border border-white/12 bg-[#090c11]/72 shadow-[0_18px_40px_rgba(0,0,0,0.34)] backdrop-blur-sm"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            minimapDragRef.current = true;
            moveViewportFromMinimap(event.clientX, event.clientY, event.currentTarget);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (minimapDragRef.current) {
              moveViewportFromMinimap(event.clientX, event.clientY, event.currentTarget);
            }
          }}
          onPointerUp={(event) => {
            minimapDragRef.current = false;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onPointerCancel={(event) => {
            minimapDragRef.current = false;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          style={{ width: minimap.width, height: minimap.height }}
        >
          <div className="agent-canvas-grid absolute inset-0 opacity-50" />
          {sortedTiles.map((tile) => (
            <div
              key={`minimap-${tile.id}`}
              className={`absolute rounded-[2px] ${
                tile.kind === "text"
                  ? "bg-white/92"
                  : tile.kind === "browser"
                    ? "bg-sky-400/78"
                    : "bg-rose-400/82"
              } ${
                tile.kind === "terminal" && tile.attention !== "idle" ? "animate-pulse" : ""
              }`}
              style={{
                left: (tile.x - minimap.minX) * minimap.scale,
                top: (tile.y - minimap.minY) * minimap.scale,
                width: Math.max(3, tile.width * minimap.scale),
                height: Math.max(3, tile.height * minimap.scale)
              }}
            />
          ))}
          <div
            className="absolute rounded-[3px] border border-white/80 bg-white/8 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
            style={minimap.viewportRect}
          />
        </div>
        ) : null}
      </div>
      {commandOpen ? (
        <div className="absolute inset-0 z-[1000001] flex items-center justify-center bg-black/35 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0d1117]/96 p-4 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Quick Create
                </div>
                <div className="mt-1 text-[16px] font-medium">
                  {commandStep === 1 ? "Choose machine" : "Choose preset"}
                </div>
              </div>
              <button
                className="inline-flex size-8 items-center justify-center rounded-md border border-white/10 text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground"
                onClick={() => setCommandOpen(false)}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
            {commandStep === 1 ? (
              <div className="space-y-4">
                <div className="grid gap-2">
                  {hosts.map((host) => (
                    <button
                      key={host.id}
                      className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                        draftHost.id === host.id
                          ? "border-sky-400/40 bg-sky-400/10"
                          : "border-white/8 bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                      onClick={() => setDraftHost(host)}
                      type="button"
                    >
                      <div className="flex items-center gap-3">
                        {host.kind === "local" ? <Laptop className="size-4" /> : <Server className="size-4" />}
                        <div>
                          <div className="text-[13px] font-medium">{host.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {host.kind === "local"
                              ? "Local machine"
                              : `${host.username || "root"}@${host.address}${host.port ? `:${host.port}` : ""}`}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                  <div className="mb-2 flex items-center gap-2 text-[12px] font-medium">
                    <Sparkles className="size-4" />
                    Custom SSH host
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input className="h-9 rounded-md border border-white/8 bg-white/[0.03] px-3 text-[12px]" placeholder="Name" value={draftHost.kind === "ssh" ? draftHost.name : ""} onChange={(e) => setDraftHost({ ...(draftHost.kind === "ssh" ? draftHost : DEFAULT_HOSTS[1]), name: e.target.value, kind: "ssh" })} />
                    <input className="h-9 rounded-md border border-white/8 bg-white/[0.03] px-3 text-[12px]" placeholder="Host / IP" value={draftHost.kind === "ssh" ? draftHost.address || "" : ""} onChange={(e) => setDraftHost({ ...(draftHost.kind === "ssh" ? draftHost : DEFAULT_HOSTS[1]), address: e.target.value, kind: "ssh" })} />
                    <input className="h-9 rounded-md border border-white/8 bg-white/[0.03] px-3 text-[12px]" placeholder="Username" value={draftHost.kind === "ssh" ? draftHost.username || "" : ""} onChange={(e) => setDraftHost({ ...(draftHost.kind === "ssh" ? draftHost : DEFAULT_HOSTS[1]), username: e.target.value, kind: "ssh" })} />
                    <input className="h-9 rounded-md border border-white/8 bg-white/[0.03] px-3 text-[12px]" placeholder="Working dir (optional)" value={draftCwd} onChange={(e) => setDraftCwd(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => setCommandStep(2)}
                    type="button"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-2 md:grid-cols-2">
                  {[
                    ["claude", "Claude"],
                    ["claude-resume", "Claude Resume"],
                    ["codex", "Codex"],
                    ["codex-resume", "Codex Resume"],
                    ["shell", "Shell"],
                    ["custom", "Custom command"]
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={`rounded-xl border px-3 py-3 text-left transition ${
                        draftPreset === value
                          ? "border-sky-400/40 bg-sky-400/10"
                          : "border-white/8 bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                      onClick={() => setDraftPreset(value as any)}
                      type="button"
                    >
                      <div className="text-[13px] font-medium">{label}</div>
                    </button>
                  ))}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input className="h-9 rounded-md border border-white/8 bg-white/[0.03] px-3 text-[12px]" placeholder="Tile title (optional)" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
                  <input className="h-9 rounded-md border border-white/8 bg-white/[0.03] px-3 text-[12px]" placeholder="Working dir (optional)" value={draftCwd} onChange={(e) => setDraftCwd(e.target.value)} />
                </div>
                {draftPreset === "custom" ? (
                  <input className="h-10 w-full rounded-md border border-white/8 bg-white/[0.03] px-3 text-[12px]" placeholder="Command to run" value={draftCommand} onChange={(e) => setDraftCommand(e.target.value)} />
                ) : null}
                <div className="flex justify-between">
                  <Button onClick={() => setCommandStep(1)} type="button" variant="ghost">
                    Back
                  </Button>
                  <Button onClick={submitCommandCreation} type="button">
                    Spawn
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-4 right-4 z-[1000001] flex w-[320px] flex-col gap-2">
        {toasts.slice(-4).map((toast) => (
          <button
            key={toast.id}
            className={`pointer-events-auto rounded-xl border px-3 py-3 text-left shadow-[0_16px_32px_rgba(0,0,0,0.28)] backdrop-blur ${
              toast.tone === "warning"
                ? "border-amber-400/25 bg-amber-400/10"
                : toast.tone === "danger"
                  ? "border-rose-400/25 bg-rose-400/10"
                  : "border-white/10 bg-[#101318]/94"
            }`}
            onClick={() => {
              centerViewportOnTile(toast.tileId);
              dismissToast(toast.id);
            }}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[12px] font-medium">{toast.title}</div>
                <div className="mt-1 text-[12px] text-muted-foreground">{toast.message}</div>
              </div>
              <button
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  dismissToast(toast.id);
                }}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </button>
        ))}
      </div>
      {activeAttentionTile && attentionModalOpen ? (
        <div className="absolute inset-0 z-[1000003] flex items-end justify-center bg-black/28 px-4 pb-5 backdrop-blur-[2px]">
          <div
            className={`w-[min(1120px,calc(100vw-32px))] overflow-hidden rounded-2xl border shadow-[0_28px_80px_rgba(0,0,0,0.48)] ${
              attentionTone(activeAttentionTile) === "warning"
                ? "border-amber-400/28 bg-[#0f1115]/96"
                : attentionTone(activeAttentionTile) === "danger"
                  ? "border-rose-400/28 bg-[#0f1115]/96"
                  : "border-emerald-400/24 bg-[#0f1115]/96"
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`inline-flex size-2.5 shrink-0 rounded-full ${
                    activeAttentionTile.attention === "needs-input"
                      ? "bg-amber-400 animate-pulse"
                      : activeAttentionTile.attention === "failed"
                        ? "bg-rose-400 animate-pulse"
                        : "bg-emerald-400 animate-pulse"
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-[15px] font-medium">
                    {attentionTitle(activeAttentionTile)} · {activeAttentionTile.title}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">
                    {activeAttentionTile.host.kind === "local"
                      ? "Local machine"
                      : `${activeAttentionTile.host.username || "root"}@${activeAttentionTile.host.address}`}
                    {" · "}
                    {activeAttentionTile.lastPreview || "No preview available"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-[11px] text-muted-foreground">
                  {attentionIndex + 1} / {attentionQueue.length}
                </div>
                <Button
                  disabled={attentionQueue.length <= 1}
                  onClick={() =>
                    setAttentionIndex((current) =>
                      current === 0 ? attentionQueue.length - 1 : current - 1
                    )
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Back
                </Button>
                <Button
                  disabled={attentionQueue.length <= 1}
                  onClick={() =>
                    setAttentionIndex((current) => (current + 1) % attentionQueue.length)
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Next
                </Button>
                <Button
                  onClick={() => centerViewportOnTile(activeAttentionTile.id)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Jump
                </Button>
                <Button
                  onClick={() => clearTerminalAttention(activeAttentionTile.id)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Dismiss
                </Button>
                <button
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground"
                  onClick={() => setAttentionModalOpen(false)}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="h-[min(68vh,720px)] bg-[#0b0d10]">
              <TerminalPane tileId={activeAttentionTile.id} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
