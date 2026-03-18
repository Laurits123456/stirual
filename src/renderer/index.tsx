import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "@xterm/xterm/css/xterm.css";
import "./styles.css";
import App from "./app";
import { RuntimeProvider } from "./runtime";

class RenderErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  public constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  public static getDerivedStateFromError(error: unknown) {
    return {
      error: error instanceof Error ? error.stack || error.message : String(error)
    };
  }

  public render() {
    if (this.state.error) {
      return <BootFailurePanel details={this.state.error} title="Renderer crashed" />;
    }

    return this.props.children;
  }
}

function BootFailurePanel({
  title,
  details
}: {
  title: string;
  details: string;
}) {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0b0d10] p-6 text-foreground">
      <div className="w-full max-w-3xl rounded-[28px] border border-red-400/20 bg-[#111317] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.4)]">
        <p className="text-[11px] uppercase tracking-[0.28em] text-red-300/80">Boot error</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
        <pre className="mt-4 overflow-auto rounded-2xl border border-white/8 bg-black/30 p-4 text-sm leading-6 text-muted-foreground">
          {details}
        </pre>
      </div>
    </div>
  );
}

function BootGuard() {
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.deck) {
      setBootError("Preload bridge is missing: window.deck is undefined");
      return;
    }

    const onError = (event: ErrorEvent) => {
      const message = event.error instanceof Error ? event.error.stack || event.error.message : event.message;
      setBootError(message || "Unknown renderer error");
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error ? reason.stack || reason.message : String(reason);
      setBootError(message || "Unhandled promise rejection");
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  if (bootError) {
    return <BootFailurePanel details={bootError} title="Runtime failed to start" />;
  }

  return (
    <RenderErrorBoundary>
      <RuntimeProvider>
        <App />
      </RuntimeProvider>
    </RenderErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<BootGuard />);
