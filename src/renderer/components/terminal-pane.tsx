import { useEffect, useRef } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useDeckStore } from "@/renderer/store";

export function TerminalPane({ tileId }: { tileId: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const lastPasteRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const pendingWriteRef = useRef("");
  const flushingWriteRef = useRef(false);
  const runtimeSessionIdRef = useRef<string | undefined>(undefined);
  const fitFrameRef = useRef<number | null>(null);
  const fitTimeoutRef = useRef<number | null>(null);
  const lastMeasuredSizeRef = useRef<{ cols: number; rows: number }>({ cols: 0, rows: 0 });
  const lastContainerSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const lastOutputAtRef = useRef(0);

  function cancelScheduledFit() {
    if (fitFrameRef.current !== null) {
      cancelAnimationFrame(fitFrameRef.current);
      fitFrameRef.current = null;
    }
    if (fitTimeoutRef.current !== null) {
      window.clearTimeout(fitTimeoutRef.current);
      fitTimeoutRef.current = null;
    }
  }

  function syncPtySizeFromCurrentTerminal() {
    const terminal = terminalRef.current;
    const current = useDeckStore.getState().tiles[tileId];
    if (!terminal || current?.kind !== "terminal" || !current.runtimeSessionId) {
      return;
    }
    if (
      terminal.cols === lastMeasuredSizeRef.current.cols &&
      terminal.rows === lastMeasuredSizeRef.current.rows
    ) {
      return;
    }
    lastMeasuredSizeRef.current = { cols: terminal.cols, rows: terminal.rows };
    void window.deck
      .resizeSession(current.runtimeSessionId, terminal.cols, terminal.rows)
      .catch(() => undefined);
  }

  function fitAndSyncCurrentTerminal() {
    fitRef.current?.fit();
    syncPtySizeFromCurrentTerminal();
  }

  function scheduleFitAndSync(delay = 180) {
    cancelScheduledFit();
    fitTimeoutRef.current = window.setTimeout(() => {
      const idleFor = Date.now() - lastOutputAtRef.current;
      if (idleFor < 280) {
        scheduleFitAndSync(280 - idleFor);
        return;
      }
      fitTimeoutRef.current = null;
      fitFrameRef.current = requestAnimationFrame(() => {
        fitFrameRef.current = requestAnimationFrame(() => {
          fitAndSyncCurrentTerminal();
          fitFrameRef.current = null;
        });
      });
    }, delay);
  }

  function flushTerminalWrites() {
    const terminal = terminalRef.current;
    if (!terminal || flushingWriteRef.current || !pendingWriteRef.current) {
      return;
    }
    flushingWriteRef.current = true;
    const chunk = pendingWriteRef.current.slice(0, 12000);
    pendingWriteRef.current = pendingWriteRef.current.slice(chunk.length);
    terminal.write(chunk, () => {
      flushingWriteRef.current = false;
      if (pendingWriteRef.current) {
        queueMicrotask(flushTerminalWrites);
      }
    });
  }

  function enqueueTerminalWrite(data: string) {
    if (!data) {
      return;
    }
    lastOutputAtRef.current = Date.now();
    pendingWriteRef.current += data;
    flushTerminalWrites();
  }

  async function writeToActiveSession(data: string) {
    const current = useDeckStore.getState().tiles[tileId];
    if (current?.kind === "terminal" && current.runtimeSessionId) {
      await window.deck.writeSession(current.runtimeSessionId, data);
    }
  }

  async function pasteIntoTerminal(text: string) {
    const now = Date.now();
    if (lastPasteRef.current.text === text && now - lastPasteRef.current.at < 200) {
      return;
    }
    lastPasteRef.current = { text, at: now };
    await writeToActiveSession(text.replace(/\r?\n/g, "\r"));
  }
  const tile = useDeckStore((state) => {
    const candidate = state.tiles[tileId];
    return candidate?.kind === "terminal" ? candidate : undefined;
  });

  useEffect(() => {
    const terminal = new Terminal({
      convertEol: false,
      cursorBlink: true,
      customGlyphs: false,
      fontFamily: '"Cascadia Mono", "Cascadia Code", Consolas, "IBM Plex Mono", monospace',
      fontSize: 14,
      fontWeight: 400,
      fontWeightBold: 600,
      letterSpacing: 0,
      lineHeight: 1,
      rescaleOverlappingGlyphs: false,
      scrollback: 5000,
      windowsPty: {
        backend: "conpty",
        buildNumber: 22631
      },
      theme: {
        background: "#0b0d10",
        foreground: "#f4f6fb",
        cursor: "#fafafa",
        cursorAccent: "#0b0d10",
        selectionBackground: "rgba(244, 246, 251, 0.16)"
      }
    });
    terminal.attachCustomKeyEventHandler((event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        void navigator.clipboard
          .readText()
          .then((text) => pasteIntoTerminal(text))
          .catch(() => undefined);
        event.preventDefault();
        return false;
      }
      if (event.shiftKey && event.key === "Insert") {
        void navigator.clipboard
          .readText()
          .then((text) => pasteIntoTerminal(text))
          .catch(() => undefined);
        event.preventDefault();
        return false;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && terminal.hasSelection()) {
        const selection = terminal.getSelection();
        if (selection) {
          void navigator.clipboard.writeText(selection).catch(() => undefined);
        }
        event.preventDefault();
        return false;
      }
      return true;
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminalRef.current = terminal;
    fitRef.current = fitAddon;
    pendingWriteRef.current = "";
    flushingWriteRef.current = false;
    lastMeasuredSizeRef.current = { cols: 0, rows: 0 };
    lastContainerSizeRef.current = { width: 0, height: 0 };
    lastOutputAtRef.current = 0;

    if (hostRef.current) {
      terminal.open(hostRef.current);
      scheduleFitAndSync(0);
      void document.fonts?.ready.then(() => {
        scheduleFitAndSync(0);
      });
    }

    const disposeInput = terminal.onData((data) => {
      void writeToActiveSession(data).catch(() => undefined);
    });

    const stopData = window.deck.onSessionData(({ id, data }) => {
      if (id !== runtimeSessionIdRef.current) {
        return;
      }
      enqueueTerminalWrite(data);
    });

    const stopExit = window.deck.onSessionExit(({ id }) => {
      if (id !== runtimeSessionIdRef.current) {
        return;
      }
      runtimeSessionIdRef.current = undefined;
    });

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = Math.round(entry?.contentRect.width ?? 0);
      const height = Math.round(entry?.contentRect.height ?? 0);
      if (
        width === lastContainerSizeRef.current.width &&
        height === lastContainerSizeRef.current.height
      ) {
        return;
      }
      lastContainerSizeRef.current = { width, height };
      scheduleFitAndSync();
    });

    if (hostRef.current) {
      observer.observe(hostRef.current);
    }

    const pasteTarget =
      hostRef.current?.querySelector("textarea.xterm-helper-textarea") ?? hostRef.current;
    const handlePaste = (event: Event) => {
      const clipboardEvent = event as ClipboardEvent;
      const text = clipboardEvent.clipboardData?.getData("text");
      if (!text) {
        return;
      }
      clipboardEvent.preventDefault();
      void pasteIntoTerminal(text).catch(() => undefined);
    };
    const handleCopy = (event: Event) => {
      const clipboardEvent = event as ClipboardEvent;
      const selection = terminal.getSelection();
      if (!selection) {
        return;
      }
      clipboardEvent.preventDefault();
      clipboardEvent.clipboardData?.setData("text/plain", selection);
      void navigator.clipboard.writeText(selection).catch(() => undefined);
    };

    pasteTarget?.addEventListener("paste", handlePaste);
    hostRef.current?.addEventListener("copy", handleCopy);

    const handleFocus = () => {
      requestAnimationFrame(() => {
        terminal.focus();
      });
    };

    hostRef.current?.addEventListener("pointerdown", handleFocus);

    return () => {
      observer.disconnect();
      pasteTarget?.removeEventListener("paste", handlePaste);
      hostRef.current?.removeEventListener("copy", handleCopy);
      hostRef.current?.removeEventListener("pointerdown", handleFocus);
      disposeInput.dispose();
      stopData();
      stopExit();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
      cancelScheduledFit();
      pendingWriteRef.current = "";
      flushingWriteRef.current = false;
      runtimeSessionIdRef.current = undefined;
      lastContainerSizeRef.current = { width: 0, height: 0 };
      lastOutputAtRef.current = 0;
    };
  }, [tileId]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal || !tile) {
      return;
    }
    if (runtimeSessionIdRef.current !== tile.runtimeSessionId) {
      runtimeSessionIdRef.current = tile.runtimeSessionId;
      pendingWriteRef.current = "";
      flushingWriteRef.current = false;
      lastMeasuredSizeRef.current = { cols: 0, rows: 0 };
      lastOutputAtRef.current = 0;
      terminal.reset();
      scheduleFitAndSync(0);
    }
  }, [tile?.runtimeSessionId, tile]);

  return <div className="relative size-full min-h-0 [&_.xterm]:size-full" ref={hostRef} />;
}
