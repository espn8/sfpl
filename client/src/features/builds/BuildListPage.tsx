import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchMe } from "../auth/api";
import { canCreateContent } from "../auth/roles";
import { SearchBar, SearchEmptyState, useSearchState } from "../search";
import { listBuilds, type ListBuildsFilters } from "./api";
import { BuildListCard } from "./BuildListCard";

export function BuildListPage() {
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

  const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe });
  const pageSize = 20;

  const apiFilters = useMemo<ListBuildsFilters>(
    () => ({
      q: debouncedFilters.q.trim() || undefined,
      sort: debouncedFilters.sort,
      mine: mineFilter || undefined,
      includeAnalytics: showAnalytics || undefined,
      page,
      pageSize,
    }),
    [debouncedFilters, mineFilter, showAnalytics, page, pageSize],
  );

  const query = useQuery({
    queryKey: ["builds", apiFilters],
    queryFn: () => listBuilds(apiFilters),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {showAnalytics ? "My Build Analytics" : mineFilter ? "Your Builds" : "Builds"}
        </h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          {showAnalytics
            ? "See how your builds are performing with views, opens, and favorites."
            : mineFilter
              ? "Builds you've created. Edit or manage your contributions."
              : "Reusable AI tools, apps, and demo assets built by the team."}
        </p>
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
        placeholder="Search builds... (try 'dashboard' or 'custom GPT')"
        showFilters={false}
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
            {query.data.data.map((build) => (
              <BuildListCard key={build.id} build={build} showAnalytics={showAnalytics} />
            ))}
          </div>
          {query.data.data.length === 0 ? (
            <SearchEmptyState
              variant={debouncedFilters.q || activeFilters.length > 0 ? "no-results" : "no-assets"}
              query={debouncedFilters.q}
              activeFilters={activeFilters}
              assetType="build"
              onClearFilters={clearAllFilters}
              canCreate={canCreateContent(meQuery.data?.role)}
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
