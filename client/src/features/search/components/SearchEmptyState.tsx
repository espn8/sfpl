import { Link } from "react-router-dom";
import type { ActiveFilter } from "../types";

type SearchEmptyStateVariant = "no-results" | "no-assets" | "error";

type SearchEmptyStateProps = {
  variant: SearchEmptyStateVariant;
  query?: string;
  activeFilters?: ActiveFilter[];
  assetType?: "prompt" | "skill" | "context" | "all";
  onClearFilters?: () => void;
  onRetry?: () => void;
  error?: Error | null;
};

export function SearchEmptyState({
  variant,
  query,
  activeFilters = [],
  assetType = "all",
  onClearFilters,
  onRetry,
  error,
}: SearchEmptyStateProps) {
  if (variant === "error") {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center dark:border-red-900/50 dark:bg-red-950/20">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <svg
            className="h-8 w-8 text-red-600 dark:text-red-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">Something went wrong</h3>
        <p className="mt-1 max-w-md text-sm text-red-600 dark:text-red-400">
          {error?.message ?? "We couldn't load the results. Please try again."}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (variant === "no-assets") {
    const config = {
      skill: {
        createLink: "/skills/new",
        label: "skill",
        title: "No skills yet",
        description: "Skills are reusable AI instructions that teach your tools how to perform specific tasks. Create the first one and help the team work smarter.",
        buttonText: "Create the first skill",
      },
      context: {
        createLink: "/context/new",
        label: "context document",
        title: "No context documents yet",
        description: "Context documents give your AI tools the background knowledge they need—style guides, coding standards, project specs, and more.",
        buttonText: "Add the first context",
      },
      prompt: {
        createLink: "/prompts/new",
        label: "prompt",
        title: "No prompts yet",
        description: "Prompts are ready-to-use templates that help you get consistent, high-quality results from AI tools. Share yours with the team.",
        buttonText: "Create the first prompt",
      },
      all: {
        createLink: "/prompts/new",
        label: "asset",
        title: "Nothing here yet",
        description: "This library is waiting for its first contribution. Add a prompt, skill, or context document to get started.",
        buttonText: "Create something",
      },
    };

    const { createLink, title, description, buttonText } = config[assetType];

    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-(--color-border) bg-(--color-surface) px-6 py-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--color-primary)/10">
          <svg
            className="h-8 w-8 text-(--color-primary)"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 max-w-md text-sm text-(--color-text-muted)">
          {description}
        </p>
        <Link
          to={createLink}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-medium text-white hover:bg-(--color-primary)/90"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          {buttonText}
        </Link>
      </div>
    );
  }

  const hasFilters = activeFilters.length > 0;
  const hasQuery = query && query.trim().length > 0;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-(--color-border) bg-(--color-surface) px-6 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--color-surface-muted)">
        <svg
          className="h-8 w-8 text-(--color-text-muted)"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold">No results found</h3>
      <p className="mt-1 max-w-md text-sm text-(--color-text-muted)">
        {hasQuery && hasFilters
          ? `No assets match "${query}" with the selected filters.`
          : hasQuery
            ? `No assets match "${query}".`
            : hasFilters
              ? "No assets match the selected filters."
              : "No assets found."}
      </p>

      <div className="mt-4 space-y-2">
        <p className="text-sm text-(--color-text-muted)">Try:</p>
        <ul className="space-y-1 text-sm text-(--color-text-muted)">
          {hasFilters && <li>• Removing some filters</li>}
          {hasQuery && <li>• Using different keywords</li>}
          <li>• Searching across all tools</li>
        </ul>
      </div>

      {(hasFilters || hasQuery) && onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-2 text-sm font-medium hover:bg-(--color-surface-muted)"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
