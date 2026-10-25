// Catches a crash in part of a page so the rest keeps working and the person sees what
// happened with a way out, never an empty or black screen (DEC-0058). Each app wraps its
// whole tree in one (the last line of defence) and each page in another, keyed by the
// route, so moving to another page clears the error.
//
// A crash caused by a file that a newer deploy replaced (the page asked for code that is no
// longer there) reloads the page once instead, which picks up the new files.
import { Component, Fragment, lazy, type ComponentType, type ErrorInfo, type LazyExoticComponent, type ReactNode } from "react";

const RELOAD_KEY = "parity.boot.reload";

/** True for the errors a browser gives when a code file could not be fetched. */
export function isChunkError(e: unknown): boolean {
  const m = String((e as { message?: unknown })?.message ?? e ?? "");
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch dynamically|ChunkLoadError|Unable to preload CSS/i.test(m);
}

/** Reloads once for a missing code file; false when it already tried (then show the error). */
export function reloadForNewFiles(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return false;
    sessionStorage.setItem(RELOAD_KEY, "1");
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

interface Props {
  children: ReactNode;
  /** "page" draws inside the page area; "app" fills the screen. */
  scope?: "page" | "app";
  /** Called with the error, for logging. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State { error: Error | null; tries: number }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, tries: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isChunkError(error) && reloadForNewFiles()) return;
    console.error("[parity] a part of the page stopped:", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  retry = () => this.setState((s) => ({ error: null, tries: s.tries + 1 }));

  render() {
    const { error, tries } = this.state;
    if (!error) return <Fragment key={tries}>{this.props.children}</Fragment>;
    const app = this.props.scope === "app";
    return (
      <div className={`ui-crash ${app ? "ui-crash-app" : ""}`} role="alert">
        <div className="ui-crash-box">
          <h2 className="ui-crash-t">{app ? "Parity stopped working on this page" : "This part of the page stopped working"}</h2>
          <p className="ui-crash-p">Try again to draw it once more. If it keeps happening, reload the page.</p>
          <div className="ui-crash-row">
            <button type="button" className="ui-crash-go" onClick={this.retry}>Try again</button>
            <button type="button" className="ui-crash-btn" onClick={() => window.location.reload()}>Reload the page</button>
          </div>
          <details className="ui-crash-d"><summary>What went wrong</summary><code>{String(error.message || error).slice(0, 400)}</code></details>
        </div>
      </div>
    );
  }
}

/**
 * React.lazy for a page, retried once when its file fails to arrive (a dropped connection),
 * then a reload when a newer deploy removed it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await load();
    } catch {
      await new Promise((ok) => setTimeout(ok, 400));
      return load();
    }
  });
}
