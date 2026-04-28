import { Component, type ErrorInfo, type ReactNode } from "react";

type RouteErrorBoundaryProps = {
  children: ReactNode;
  /** `fullscreen` for app root; `embedded` for main column under AppShell. */
  placement?: "fullscreen" | "embedded";
};

type RouteErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[RouteErrorBoundary]", error.message, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { children, placement = "fullscreen" } = this.props;
    const { hasError, error } = this.state;

    if (!hasError || !error) {
      return children;
    }

    const isEmbedded = placement === "embedded";

    return (
      <div
        role="alert"
        className={
          isEmbedded
            ? "rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-8 text-center"
            : "flex min-h-screen flex-col items-center justify-center gap-4 bg-(--color-bg) px-6 text-center text-(--color-text)"
        }
      >
        <h1 className={isEmbedded ? "text-lg font-semibold" : "text-xl font-semibold"}>
          Something went wrong
        </h1>
        <p className="max-w-md text-sm text-(--color-text-muted)">
          This page hit an unexpected error. You can try again or reload the app. If the problem persists after a
          deploy, try a hard refresh (clear cache).
        </p>
        {import.meta.env.DEV && error.message ? (
          <pre className="max-h-32 max-w-full overflow-auto rounded border border-(--color-border) bg-(--color-surface-muted) p-2 text-left text-xs text-(--color-text-muted)">
            {error.message}
          </pre>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-2 text-sm font-medium text-(--color-text) hover:bg-(--color-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
            onClick={this.handleRetry}
          >
            Try again
          </button>
          <button
            type="button"
            className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
