import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SearchBar, SearchEmptyState, useSearchState } from "../search";
import { listContext, type ListContextFilters } from "./api";
import { ContextListCard } from "./ContextListCard";

export function ContextListPage() {
  const [searchParams] = useSearchParams();
  const mineFilter = searchParams.get("mine") === "true";
  const showAnalytics = searchParams.get("showAnalytics") === "true";

  const {
    filters,
    debouncedFilters,
    inputValue,
    setInputValue,
    setFilter,
    clearFilter,
    clearAllFilters,
    activeFilters,
    page,
    setPage,
    parseAndApplyNaturalLanguage,
    isParsing,
  } = useSearchState();

  const pageSize = 20;

  const apiFilters = useMemo<ListContextFilters>(
    () => ({
      q: debouncedFilters.q.trim() || undefined,
      tool: debouncedFilters.tool || undefined,
      sort: debouncedFilters.sort === "mostUsed" ? "mostUsed" : "recent",
      mine: mineFilter || undefined,
      includeAnalytics: showAnalytics || undefined,
      page,
      pageSize,
    }),
    [debouncedFilters, mineFilter, showAnalytics, page, pageSize],
  );

  const query = useQuery({
    queryKey: ["context", apiFilters],
    queryFn: () => listContext(apiFilters),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {showAnalytics ? "My Context Analytics" : mineFilter ? "Your Context" : "Context"}
          </h1>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            {showAnalytics
              ? "See how your context documents are performing with views, copies, and favorites."
              : mineFilter
                ? "Context documents you've created. Edit or manage your contributions."
                : "Reference documents, rules, and guidelines you can load into your AI tools. Add anything that helps your AI understand your world."}
          </p>
        </div>
        <Link
          to="/context/new"
          className="inline-flex items-center justify-center rounded-full bg-linear-to-r from-indigo-500 via-fuchsia-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
        >
          Add Context
        </Link>
      </div>

      <SearchBar
        inputValue={inputValue}
        onInputChange={setInputValue}
        filters={filters}
        activeFilters={activeFilters}
        onFilterChange={setFilter}
        onFilterRemove={clearFilter}
        onClearAll={clearAllFilters}
        onSubmit={parseAndApplyNaturalLanguage}
        isParsing={isParsing}
        placeholder="Search context... (try 'style guides')"
      />

      {query.isLoading ? <p className="text-sm text-(--color-text-muted)">Just a moment...</p> : null}
      {query.isError ? (
        <SearchEmptyState
          variant="error"
          error={query.error as Error}
          onRetry={() => query.refetch()}
        />
      ) : null}

      {query.data ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {query.data.data.map((doc) => (
              <ContextListCard key={doc.id} context={doc} showAnalytics={showAnalytics} />
            ))}
          </div>
          {query.data.data.length === 0 ? (
            <SearchEmptyState
              variant={debouncedFilters.q || activeFilters.length > 0 ? "no-results" : "no-assets"}
              query={debouncedFilters.q}
              activeFilters={activeFilters}
              assetType="context"
              onClearFilters={clearAllFilters}
            />
          ) : null}
          {query.data.meta.totalPages > 1 ? (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1.5 disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage(Math.max(1, page - 1))}
              >
                Previous
              </button>
              <span className="text-sm text-(--color-text-muted)">
                Page {page} of {query.data.meta.totalPages}
              </span>
              <button
                type="button"
                className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1.5 disabled:opacity-50"
                disabled={page >= query.data.meta.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
