import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { trackEvent } from "../../app/analytics";
import { createCollection, listCollections } from "./api";
import { PromptThumbnail } from "../prompts/PromptThumbnail";

const COLLECTIONS_PAGE_SIZE = 6;
const COLLECTIONS_FETCH_PAGE_SIZE = 100;

type CollectionScopeFilter = "all" | "mine";

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

export function CollectionsPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(COLLECTIONS_PAGE_SIZE);
  const [scopeFilter, setScopeFilter] = useState<CollectionScopeFilter>("all");
  const listMineOnly = scopeFilter === "mine";
  const collectionsQuery = useQuery({
    queryKey: ["collections", { mine: listMineOnly }],
    queryFn: () =>
      listCollections({
        mine: listMineOnly || undefined,
        page: 1,
        pageSize: COLLECTIONS_FETCH_PAGE_SIZE,
      }),
  });

  useEffect(() => {
    setVisibleCount(COLLECTIONS_PAGE_SIZE);
  }, [scopeFilter]);
  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: createCollection,
    onSuccess: () => {
      setFormError(null);
      trackEvent("collection_create");
      void queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
    onError: () => {
      setFormError("Could not create collection. Try a different name.");
    },
  });

  const collections = collectionsQuery.data ?? [];
  const visibleCollections = collections.slice(0, visibleCount);
  const hasMoreCollections = visibleCount < collections.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold">Collections</h2>
        <div
          className="inline-flex w-fit rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-0.5"
          role="group"
          aria-label="Which collections to show"
        >
          <button
            type="button"
            onClick={() => setScopeFilter("all")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              scopeFilter === "all"
                ? "bg-(--color-surface) text-(--color-text) shadow-sm"
                : "text-(--color-text-muted) hover:text-(--color-text)"
            }`}
          >
            All collections
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter("mine")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              scopeFilter === "mine"
                ? "bg-(--color-surface) text-(--color-text) shadow-sm"
                : "text-(--color-text-muted) hover:text-(--color-text)"
            }`}
          >
            My collections
          </button>
        </div>
      </div>
      <form
        className="flex gap-2 rounded border border-(--color-border) bg-(--color-surface) p-3"
        onSubmit={(event) => {
          event.preventDefault();
          setFormError(null);
          const formData = new FormData(event.currentTarget);
          const name = String(formData.get("name") ?? "").trim();
          const description = String(formData.get("description") ?? "").trim();
          if (!name) {
            setFormError("Collection name is required.");
            return;
          }
          createMutation.mutate({ name, description: description || undefined });
          event.currentTarget.reset();
        }}
      >
        <div className="flex w-full flex-col gap-2">
          <input
            name="name"
            className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
            placeholder="Name your collection"
          />
          <input
            name="description"
            className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
            placeholder="What's this collection for?"
          />
          {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded bg-(--color-primary) px-3 py-2 text-(--color-text-inverse) hover:bg-(--color-primary-active) active:bg-(--color-primary-active)"
        >
          {createMutation.isPending ? "Creating..." : "Create Collection"}
        </button>
      </form>
      {collectionsQuery.isLoading ? (
        <p className="text-sm text-(--color-text-muted)">Loading collections...</p>
      ) : null}
      {collectionsQuery.isError ? (
        <p className="text-sm text-red-600" role="alert">
          We couldn't load collections right now. Try refreshing.
        </p>
      ) : null}
      {collectionsQuery.data?.length === 0 && !collectionsQuery.isLoading ? (
        <p className="text-sm text-(--color-text-muted)">
          {scopeFilter === "mine"
            ? "You have not created any collections yet. Create one above to get started."
            : "No collections yet. Create one above to organize your favorite prompts."}
        </p>
      ) : null}
      {visibleCollections.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCollections.map((collection) => (
              <div key={collection.id} className="rounded border border-(--color-border) bg-(--color-surface) p-4">
                <Link to={`/collections/${collection.id}`} className="font-semibold hover:underline">
                  {collection.name}
                </Link>
                <p className="text-sm text-(--color-text-muted)">{collection.description}</p>
                <p className="text-xs text-(--color-text-muted)">{pluralize(collection.prompts.length, "AI asset")}</p>
                <div className="mt-2 flex gap-2">
                  {collection.prompts.slice(0, 3).map((entry) => (
                    <PromptThumbnail
                      key={entry.prompt.id}
                      title={entry.prompt.title}
                      thumbnailUrl={entry.prompt.thumbnailUrl}
                      thumbnailStatus={entry.prompt.thumbnailStatus}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {hasMoreCollections ? (
            <div className="flex justify-center">
              <button
                type="button"
                className="rounded border border-(--color-border) bg-(--color-surface-muted) px-4 py-2 text-sm font-medium text-(--color-text) hover:bg-(--color-surface) active:bg-(--color-surface)"
                onClick={() => setVisibleCount((n) => n + COLLECTIONS_PAGE_SIZE)}
              >
                Load more
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
