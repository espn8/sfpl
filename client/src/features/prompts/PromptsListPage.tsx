import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SearchBar, SearchEmptyState, useSearchState } from "../search";
import { listCollections } from "../collections/api";
import { listPrompts, type ListPromptsFilters, type PromptModality, type PromptTool } from "./api";
import { PromptListCard } from "./PromptListCard";

export function PromptsListPage() {
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

  const apiFilters = useMemo<ListPromptsFilters>(() => {
    const nextFilters: ListPromptsFilters = {
      page,
      pageSize,
      sort: debouncedFilters.sort === "topRated" ? "topRated" : debouncedFilters.sort === "mostUsed" ? "mostUsed" : "recent",
    };
    if (debouncedFilters.q.trim()) {
      nextFilters.q = debouncedFilters.q.trim();
    }
    if (debouncedFilters.collectionId) {
      nextFilters.collectionId = Number(debouncedFilters.collectionId);
    }
    if (debouncedFilters.tool) {
      nextFilters.tool = debouncedFilters.tool as PromptTool;
    }
    if (debouncedFilters.modality) {
      nextFilters.modality = debouncedFilters.modality as PromptModality;
    }
    if (mineFilter) {
      nextFilters.mine = true;
    }
    return nextFilters;
  }, [debouncedFilters, mineFilter, page, pageSize]);

  const promptsQuery = useQuery({
    queryKey: ["prompts", apiFilters],
    queryFn: () => listPrompts(apiFilters),
  });

  const collectionsQuery = useQuery({
    queryKey: ["collections"],
    queryFn: listCollections,
  });

  if (promptsQuery.isLoading) {
    return <p>Loading prompts...</p>;
  }

  if (promptsQuery.error) {
    return (
      <SearchEmptyState
        variant="error"
        error={promptsQuery.error as Error}
        onRetry={() => promptsQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {showAnalytics ? "My Prompt Analytics" : mineFilter ? "Your Prompts" : "Prompts"}
          </h1>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            {showAnalytics
              ? "See how your prompts are performing with views, uses, and ratings."
              : mineFilter
                ? "Prompts you've created. Edit or manage your contributions."
                : "Ready-to-use AI prompts you can customize and launch in your favorite tools."}
          </p>
        </div>
        <Link
          to="/prompts/new"
          className="inline-flex items-center justify-center rounded-full bg-linear-to-r from-indigo-500 via-fuchsia-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
        >
          Create Prompt
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
        placeholder="Search prompts... (try 'cursor prompts for code review')"
        showModality
        showCollections
        collections={collectionsQuery.data ?? []}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {promptsQuery.data?.data.map((prompt) => (
          <PromptListCard
            key={prompt.id}
            prompt={prompt}
            variant="default"
            showAnalytics={showAnalytics}
            highlightQuery={debouncedFilters.q}
          />
        ))}
      </div>
      {promptsQuery.data?.data.length === 0 ? (
        <SearchEmptyState
          variant={debouncedFilters.q || activeFilters.length > 0 ? "no-results" : "no-assets"}
          query={debouncedFilters.q}
          activeFilters={activeFilters}
          assetType="prompt"
          onClearFilters={clearAllFilters}
        />
      ) : null}
      {promptsQuery.data && promptsQuery.data.meta.totalPages > 1 ? (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={promptsQuery.data.meta.page <= 1}
            className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1.5 disabled:opacity-50"
            onClick={() => setPage(Math.max(1, page - 1))}
          >
            Previous
          </button>
          <p className="text-sm text-(--color-text-muted)">
            Page {promptsQuery.data.meta.page} of {promptsQuery.data.meta.totalPages}
          </p>
          <button
            type="button"
            disabled={promptsQuery.data.meta.page >= promptsQuery.data.meta.totalPages}
            className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1.5 disabled:opacity-50"
            onClick={() => setPage(Math.min(promptsQuery.data!.meta.totalPages, page + 1))}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
