import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ClientErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[author-client]", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
        <h1 className="text-xl font-semibold text-red-300">Author client failed to load</h1>
        <p className="mt-3 max-w-xl text-sm text-zinc-400">
          {this.state.error.message}
        </p>
        <p className="mt-6 text-xs text-zinc-500">
          Common fix: run <code className="text-emerald-300">npm run build:sdk -w msgf</code> or restart
          with the updated Vite config (development exports for <code>msgf/*</code>).
        </p>
        <button
          type="button"
          className="mt-6 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}
