import { join } from "node:path";
import { createRequire } from "node:module";
import type { BrowserWindow as BrowserWindowType, Event as ElectronEvent, RenderProcessGoneDetails } from "electron";
import { SessionManager } from "./session-manager";

const require = createRequire(import.meta.url);
const { app, BrowserWindow, ipcMain } = require("electron") as typeof import("electron");
const { shell } = require("electron") as typeof import("electron");

let mainWindow: BrowserWindowType | null = null;
const sessions = new SessionManager(() => mainWindow);

process.on("uncaughtException", (error) => {
  if (error.message.includes("Cannot resize a pty that has already exited")) {
    console.warn("[node-pty] ignored resize on exited session");
    return;
  }

  console.error("[main:uncaughtException]", error);
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    title: "STIRUAL",
    icon: join(process.cwd(), "build", "stirual-icon.png"),
    backgroundColor: "#0b0d10",
    autoHideMenuBar: true,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  mainWindow.webContents.on("console-message", (_event: ElectronEvent, level: number, message: string, line: number, sourceId: string) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event: ElectronEvent, errorCode: number, errorDescription: string, validatedURL: string) => {
      console.error(`[renderer:load-failed] ${errorCode} ${errorDescription} ${validatedURL}`);
    }
  );

  mainWindow.webContents.on("render-process-gone", (_event: ElectronEvent, details: RenderProcessGoneDetails) => {
    console.error("[renderer:gone]", details);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  app.setName("STIRUAL");
  if (process.platform === "win32") {
    app.setAppUserModelId("com.stirual.app");
  }
  ipcMain.handle("deck:get-version", () => app.getVersion());
  ipcMain.handle("deck:create-session", (_event, spec) => sessions.create(spec));
  ipcMain.handle("deck:write-session", (_event, id: string, data: string) => {
    sessions.write(id, data);
  });
  ipcMain.handle("deck:resize-session", (_event, id: string, cols: number, rows: number) => {
    sessions.resize(id, cols, rows);
  });
  ipcMain.handle("deck:kill-session", (_event, id: string) => {
    sessions.kill(id);
  });
  ipcMain.handle("deck:open-external", (_event, url: string) => shell.openExternal(url));

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  sessions.dispose();
});
