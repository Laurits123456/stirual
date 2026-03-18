import { contextBridge, ipcRenderer } from "electron";
import type { HostConfig, SessionPreset } from "@/main/session-manager";

const api = {
  getVersion: () => ipcRenderer.invoke("deck:get-version") as Promise<string>,
  createSession: (spec: {
      host: HostConfig;
      chatId: string;
      sessionName: string;
      preset: SessionPreset;
      cwd?: string;
      command?: string;
    }) => ipcRenderer.invoke("deck:create-session", spec) as Promise<{ id: string }>,
  writeSession: (id: string, data: string) =>
    ipcRenderer.invoke("deck:write-session", id, data) as Promise<void>,
  resizeSession: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke("deck:resize-session", id, cols, rows) as Promise<void>,
  killSession: (id: string) =>
    ipcRenderer.invoke("deck:kill-session", id) as Promise<void>,
  onSessionData: (listener: (payload: { id: string; data: string }) => void) => {
    const wrapped = (_event: unknown, payload: { id: string; data: string }) => listener(payload);
    ipcRenderer.on("deck:session-data", wrapped);
    return () => ipcRenderer.off("deck:session-data", wrapped);
  },
  onSessionExit: (listener: (payload: { id: string; exitCode: number }) => void) => {
    const wrapped = (_event: unknown, payload: { id: string; exitCode: number }) =>
      listener(payload);
    ipcRenderer.on("deck:session-exit", wrapped);
    return () => ipcRenderer.off("deck:session-exit", wrapped);
  },
  openExternal: (url: string) => ipcRenderer.invoke("deck:open-external", url) as Promise<void>
};

contextBridge.exposeInMainWorld("deck", api);
