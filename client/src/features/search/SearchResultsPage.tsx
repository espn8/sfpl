import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { listAssets, type ListAssetsFilters } from "../assets/api";
import type { PromptModality, PromptTool } from "../prompts/api";
import { AssetCard } from "../assets/AssetCard";
import { fetchMe } from "../auth/api";
import { canCreateContent } from "../auth/roles";
import { FacetedFilters, SearchBar, SearchEmptyState, useSearchState, type AssetTypeFilter } from "../search";

export function SearchResultsPage() {
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

  const apiFilters = useMemo<ListAssetsFilters>(() => {
    const nextFilters: ListAssetsFilters = {
      page,
      pageSize,
      sort: debouncedFilters.sort === "mostUsed" ? "mostUsed" : "recent",
      assetType: debouncedFilters.assetType as AssetTypeFilter,
    };
    if (debouncedFilters.q.trim()) {
      nextFilters.q = debouncedFilters.q.trim();
    }
    if (debouncedFilters.tool) {
      nextFilters.tool = debouncedFilters.tool as PromptTool;
    }
    if (debouncedFilters.tag.trim()) {
      nextFilters.tag = debouncedFilters.tag.trim();
    }
    if (debouncedFilters.modality) {
      nextFilters.modality = debouncedFilters.modality as PromptModality;
    }
    return nextFilters;
  }, [debouncedFilters, page, pageSize]);

  const assetsQuery = useQuery({
    queryKey: ["assets", apiFilters],
    queryFn: () => listAssets(apiFilters),
  });

  const assets = assetsQuery.data?.data ?? [];
  const totalPages = assetsQuery.data?.meta.totalPages ?? 1;
  const totalCount = assetsQuery.data?.meta.total ?? 0;
  const hasActiveSearch = Boolean(
    debouncedFilters.q.trim() ||
      debouncedFilters.tool ||
      debouncedFilters.tag.trim() ||
      debouncedFilters.modality ||
      debouncedFilters.assetType !== "all",
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--color-border) bg-(--color-surface) text-(--color-text-muted) transition-colors hover:bg-(--color-surface-muted) hover:text-(--color-text)"
          aria-label="Back to home"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">Search Results</h1>
      </div>

      <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-4 shadow-sm">
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
          placeholder="Search prompts, skills, context and builds... (try natural language!)"
          showAssetType
          showModality
        />
      </div>

      {assetsQuery.data?.meta.facets && (
        <FacetedFilters
          facets={assetsQuery.data.meta.facets}
          currentFilters={filters}
          onFilterChange={setFilter}
        />
      )}

      {hasActiveSearch && !assetsQuery.isLoading && assets.length > 0 && (
        <p className="text-sm text-(--color-text-muted)">
          {totalCount} result{totalCount !== 1 ? "s" : ""} found
        </p>
      )}

      {assetsQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--color-primary) border-t-transparent" />
        </div>
      ) : assetsQuery.isError ? (
        <SearchEmptyState
          variant="error"
          onRetry={() => assetsQuery.refetch()}
        />
      ) : assets.length === 0 ? (
        <SearchEmptyState
          variant={hasActiveSearch ? "no-results" : "no-assets"}
          query={debouncedFilters.q}
          activeFilters={activeFilters}
          onClearFilters={clearAllFilters}
          canCreate={canCreateContent(meQuery.data?.role)}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => (
              <AssetCard
                key={`${asset.assetType}-${asset.id}`}
                asset={asset}
                variant="default"
                highlightQuery={debouncedFilters.q}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm font-medium transition-colors hover:bg-(--color-surface-muted) disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 text-sm text-(--color-text-muted)">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm font-medium transition-colors hover:bg-(--color-surface-muted) disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
