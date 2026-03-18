import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useDeckStore } from "@/renderer/store";

type RuntimeApi = {
  closeTile: (tileId: string) => Promise<void>;
  restartTerminal: (tileId: string) => Promise<void>;
};

const RuntimeContext = createContext<RuntimeApi | null>(null);

export function RuntimeProvider({ children }: { children: React.ReactNode }) {
  const tiles = useDeckStore((state) => state.tiles);
  const setTerminalRuntime = useDeckStore((state) => state.setTerminalRuntime);
  const setTerminalFailure = useDeckStore((state) => state.setTerminalFailure);
  const markTerminalExited = useDeckStore((state) => state.markTerminalExited);
  const clearRuntimeState = useDeckStore((state) => state.clearRuntimeState);
  const restartTerminalTile = useDeckStore((state) => state.restartTerminalTile);
  const closeTileState = useDeckStore((state) => state.closeTile);
  const launching = useRef(new Set<string>());

  useEffect(() => {
    clearRuntimeState();
  }, [clearRuntimeState]);

  useEffect(() => {
    const stopData = window.deck.onSessionData(() => {
      // Terminal panes subscribe directly to session output so the whole canvas
      // doesn't rerender on every chunk of shell data.
    });
    const stopExit = window.deck.onSessionExit(({ id }) => {
      markTerminalExited(id);
    });
    return () => {
      stopData();
      stopExit();
    };
  }, [markTerminalExited]);

  useEffect(() => {
    for (const tile of Object.values(tiles)) {
      if (tile.kind !== "terminal") {
        continue;
      }

      if (tile.runtimeSessionId || launching.current.has(tile.id)) {
        continue;
      }

      if (tile.connectionState === "failed") {
        continue;
      }

      launching.current.add(tile.id);
      setTerminalRuntime(tile.id, undefined, "connecting");

      void window.deck
        .createSession({
          host: tile.host,
          chatId: tile.id,
          sessionName: tile.sessionName,
          preset: tile.preset,
          command: tile.command,
          cwd: tile.cwd
        })
        .then(({ id }) => {
          setTerminalRuntime(tile.id, id, "live");
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : "Failed to create local shell";
          setTerminalFailure(tile.id, message);
        })
        .finally(() => {
          launching.current.delete(tile.id);
        });
    }
  }, [setTerminalFailure, setTerminalRuntime, tiles]);

  const value = useMemo<RuntimeApi>(
    () => ({
      closeTile: async (tileId) => {
        const tile = useDeckStore.getState().tiles[tileId];
        if (tile?.kind === "terminal" && tile.runtimeSessionId) {
          await window.deck.killSession(tile.runtimeSessionId).catch(() => undefined);
        }
        closeTileState(tileId);
      },
      restartTerminal: async (tileId) => {
        const tile = useDeckStore.getState().tiles[tileId];
        if (!tile || tile.kind !== "terminal") {
          return;
        }
        if (tile.runtimeSessionId) {
          await window.deck.killSession(tile.runtimeSessionId).catch(() => undefined);
        }
        restartTerminalTile(tileId);
      }
    }),
    [closeTileState, restartTerminalTile]
  );

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useRuntime() {
  const context = useContext(RuntimeContext);
  if (!context) {
    throw new Error("useRuntime must be used inside RuntimeProvider");
  }
  return context;
}
