type PageLoadingFallbackProps = {
  /** `page`: full-route loading (terms/privacy, session gate). `content`: main column under AppShell. */
  variant?: "page" | "content";
};

export function PageLoadingFallback({ variant = "page" }: PageLoadingFallbackProps) {
  const minHeight = variant === "content" ? "min-h-[32vh]" : "min-h-[40vh]";
  return (
    <div
      role="status"
      aria-label="Loading page"
      className={`flex h-full ${minHeight} w-full items-center justify-center`}
    >
      <div
        aria-hidden
        className="h-8 w-8 animate-spin rounded-full border-2 border-(--color-border) border-t-(--color-accent)"
      />
    </div>
  );
}
