import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { BrowserWindow } from "electron";
import type { IPty } from "node-pty";
import { spawn } from "node-pty";

export type SessionPreset =
  | "claude"
  | "claude-resume"
  | "codex"
  | "codex-resume"
  | "shell"
  | "custom";

export type HostConfig = {
  id: string;
  name: string;
  kind: "ssh" | "local";
  address?: string;
  username?: string;
  port?: number;
};

export type SessionSpec = {
  host: HostConfig;
  chatId: string;
  sessionName: string;
  preset: SessionPreset;
  cwd?: string;
  command?: string;
};

type SessionRecord = {
  id: string;
  pty: IPty;
};

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function resolveSshExecutable() {
  if (process.platform !== "win32") {
    return "ssh";
  }

  const candidates = [
    "C:\\Windows\\System32\\OpenSSH\\ssh.exe",
    join(process.env.WINDIR || "C:\\Windows", "System32", "OpenSSH", "ssh.exe")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return "ssh";
}

function getPresetCommand(preset: SessionPreset, customCommand?: string) {
  switch (preset) {
    case "claude":
      return "claude --no-alt-screen";
    case "claude-resume":
      return "claude resume";
    case "codex":
      return "npx -y @openai/codex --dangerously-bypass-approvals-and-sandbox --no-alt-screen";
    case "codex-resume":
      return "npx -y @openai/codex --dangerously-bypass-approvals-and-sandbox --no-alt-screen resume";
    case "shell":
      return "bash -l";
    case "custom":
      return customCommand || "bash -l";
  }
}

function makeRemoteBootstrap(spec: SessionSpec) {
  const session = spec.sessionName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const command = getPresetCommand(spec.preset, spec.command);
  const setupCommands =
    spec.cwd && spec.cwd !== "~"
      ? [
          `mkdir -p ${shellQuote(spec.cwd)} >/dev/null 2>&1 || true`,
          `cd ${shellQuote(spec.cwd)} 2>/dev/null || cd ~`
        ]
      : ["cd ~"];

  const script = [
    ...setupCommands,
    `if tmux has-session -t ${shellQuote(session)} 2>/dev/null; then`,
    `  exec tmux attach-session -t ${shellQuote(session)}`,
    "else",
    `  exec tmux new-session -s ${shellQuote(session)} ${shellQuote(command)}`,
    "fi"
  ].join("; ");

  return `bash -lc ${shellQuote(script)}`;
}

function getSshArgs(spec: SessionSpec) {
  const target = `${spec.host.username || "root"}@${spec.host.address}`;
  const args = ["-tt"];
  if (spec.host.port) {
    args.push("-p", String(spec.host.port));
  }
  args.push(target, makeRemoteBootstrap(spec));
  return args;
}

export class SessionManager {
  private sessions = new Map<string, SessionRecord>();
  private readonly sshExecutable = resolveSshExecutable();

  public constructor(private readonly getWindow: () => BrowserWindow | null) {}

  public create(spec: SessionSpec) {
    const id = randomUUID();
    const pty =
      spec.host.kind === "local"
        ? spawn(
            "powershell.exe",
            spec.preset === "shell"
              ? ["-NoLogo"]
              : ["-NoLogo", "-NoExit", "-Command", getPresetCommand(spec.preset, spec.command)],
            {
            name: "xterm-256color",
            cols: 80,
            rows: 24,
            cwd: spec.cwd || homedir(),
            env: {
              ...process.env,
              TERM: "xterm-256color",
              COLORTERM: "truecolor"
            }
            }
          )
        : spawn(this.sshExecutable, getSshArgs(spec), {
            name: "xterm-256color",
            cols: 80,
            rows: 24,
            cwd: homedir(),
            env: {
              ...process.env,
              TERM: "xterm-256color",
              COLORTERM: "truecolor"
            }
          });

    this.sessions.set(id, { id, pty });

    pty.onData((data) => {
      this.getWindow()?.webContents.send("deck:session-data", {
        id,
        data
      });
    });

    pty.onExit(({ exitCode }) => {
      this.sessions.delete(id);
      this.getWindow()?.webContents.send("deck:session-exit", {
        id,
        exitCode
      });
    });

    return { id };
  }

  public write(id: string, data: string) {
    try {
      this.sessions.get(id)?.pty.write(data);
    } catch {
      this.sessions.delete(id);
    }
  }

  public resize(id: string, cols: number, rows: number) {
    if (cols < 2 || rows < 2) {
      return;
    }
    try {
      this.sessions.get(id)?.pty.resize(Math.floor(cols), Math.floor(rows));
    } catch {
      this.sessions.delete(id);
    }
  }

  public kill(id: string) {
    const session = this.sessions.get(id);
    if (!session) {
      return;
    }
    try {
      session.pty.kill();
    } catch {
      // Ignore already-exited sessions.
    }
    this.sessions.delete(id);
  }

  public dispose() {
    for (const session of this.sessions.values()) {
      session.pty.kill();
    }
    this.sessions.clear();
  }
}
