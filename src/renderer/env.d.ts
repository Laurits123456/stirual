import type { HostConfig, SessionPreset } from "@/main/session-manager";
import type * as React from "react";

export {};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          allowpopups?: boolean | string;
          partition?: string;
          webpreferences?: string;
        },
        HTMLElement
      >;
    }
  }

  interface Window {
    deck: {
      getVersion: () => Promise<string>;
      createSession: (spec: {
        host: HostConfig;
        chatId: string;
        sessionName: string;
        preset: SessionPreset;
        cwd?: string;
        command?: string;
      }) => Promise<{ id: string }>;
      writeSession: (id: string, data: string) => Promise<void>;
      resizeSession: (id: string, cols: number, rows: number) => Promise<void>;
      killSession: (id: string) => Promise<void>;
      onSessionData: (listener: (payload: { id: string; data: string }) => void) => () => void;
      onSessionExit: (
        listener: (payload: { id: string; exitCode: number }) => void
      ) => () => void;
      openExternal: (url: string) => Promise<void>;
    };
  }
}
