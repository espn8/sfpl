import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listCollections } from "../collections/api";
import { getToolLabel, getToolsSortedAlphabetically, listPrompts, type ListPromptsFilters, PROMPT_MODALITY_OPTIONS, PROMPT_TOOL_OPTIONS } from "./api";
import { PromptListCard } from "./PromptListCard";

export function PromptsListPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [tool, setTool] = useState(() => searchParams.get("tool") ?? "");
  const [modality, setModality] = useState("");
  const [sort, setSort] = useState<"recent" | "topRated" | "mostUsed">("recent");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const mineFilter = searchParams.get("mine") === "true";
  const showAnalytics = searchParams.get("showAnalytics") === "true";

  const filters = useMemo<ListPromptsFilters>(() => {
    const nextFilters: ListPromptsFilters = {
      page,
      pageSize,
      sort,
    };
    if (search.trim()) {
      nextFilters.q = search.trim();
    }
    if (collectionId) {
      nextFilters.collectionId = Number(collectionId);
    }
    if (tool) {
      nextFilters.tool = tool as (typeof PROMPT_TOOL_OPTIONS)[number];
    }
    if (modality) {
      nextFilters.modality = modality as (typeof PROMPT_MODALITY_OPTIONS)[number];
    }
    if (mineFilter) {
      nextFilters.mine = true;
    }
    return nextFilters;
  }, [collectionId, mineFilter, modality, page, search, sort, tool]);

  const promptsQuery = useQuery({
    queryKey: ["prompts", filters],
    queryFn: () => listPrompts(filters),
  });
  const collectionsQuery = useQuery({ queryKey: ["collections"], queryFn: listCollections });

  if (promptsQuery.isLoading) {
    return <p>Loading prompts...</p>;
  }

  if (promptsQuery.error) {
    return <p className="text-red-700">We couldn't load prompts right now. Try refreshing.</p>;
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

      <div className="grid gap-2 rounded border border-(--color-border) bg-(--color-surface) p-3 md:grid-cols-2 lg:grid-cols-3">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
          placeholder="Search prompts by keyword, use case, or author..."
        />
        <select
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as "recent" | "topRated" | "mostUsed");
            setPage(1);
          }}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="recent">Sort: Most recent</option>
          <option value="topRated">Sort: Top rated</option>
          <option value="mostUsed">Sort: Most used</option>
        </select>
        <select
          value={tool}
          onChange={(event) => {
            setTool(event.target.value);
            setPage(1);
          }}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="">All tools</option>
          {getToolsSortedAlphabetically().map((option) => (
            <option key={option} value={option}>
              {getToolLabel(option)}
            </option>
          ))}
        </select>
        <select
          value={modality}
          onChange={(event) => {
            setModality(event.target.value);
            setPage(1);
          }}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="">All generated output</option>
          {PROMPT_MODALITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={collectionId}
          onChange={(event) => {
            setCollectionId(event.target.value);
            setPage(1);
          }}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="">All collections</option>
          {collectionsQuery.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {promptsQuery.data?.data.map((prompt) => (
          <PromptListCard key={prompt.id} prompt={prompt} variant="default" showAnalytics={showAnalytics} />
        ))}
      </div>
      {promptsQuery.data?.data.length === 0 ? (
        <p className="text-sm text-(--color-text-muted)">No prompts found. Try adjusting your filters or create the first one.</p>
      ) : null}
      {promptsQuery.data && promptsQuery.data.meta.totalPages > 1 ? (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={promptsQuery.data.meta.page <= 1}
            className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1.5 disabled:opacity-50"
            onClick={() => {
              setPage((current) => Math.max(1, current - 1));
            }}
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
            onClick={() => {
              setPage((current) => Math.min(promptsQuery.data!.meta.totalPages, current + 1));
            }}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
