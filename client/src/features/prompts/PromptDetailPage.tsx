import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { addPromptToCollection, listCollections, removePromptFromCollection } from "../collections/api";
import type { Collection } from "../collections/api";
import { getPrompt, logUsage, ratePrompt, toggleFavorite, updatePrompt } from "./api";
import { PromptThumbnail } from "./PromptThumbnail";

export function PromptDetailPage() {
  const params = useParams();
  const promptId = Number(params.id);
  const [rating, setRating] = useState(5);
  const promptQuery = useQuery({
    queryKey: ["prompt", promptId],
    queryFn: () => getPrompt(promptId),
    enabled: Number.isInteger(promptId),
  });
  const collectionsQuery = useQuery({
    queryKey: ["collections"],
    queryFn: listCollections,
    enabled: Number.isInteger(promptId),
  });
  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: (payload: { body: string }) => updatePrompt(promptId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prompt", promptId] });
    },
  });
  const addToCollectionMutation = useMutation({
    mutationFn: (collectionId: number) => addPromptToCollection(collectionId, promptId),
    onMutate: async (collectionId: number) => {
      await queryClient.cancelQueries({ queryKey: ["collections"] });
      const previousCollections = queryClient.getQueryData<Collection[]>(["collections"]);
      queryClient.setQueryData<Collection[]>(["collections"], (current) =>
        (current ?? []).map((collection) =>
          collection.id !== collectionId || collection.prompts.some((entry) => entry.prompt.id === promptId)
            ? collection
            : {
                ...collection,
                prompts: [...collection.prompts, { prompt: { id: promptId, title: promptQuery.data?.title ?? "Prompt" } }],
              },
        ),
      );
      return { previousCollections };
    },
    onError: (_error, _collectionId, context) => {
      if (context?.previousCollections) {
        queryClient.setQueryData(["collections"], context.previousCollections);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
  const removeFromCollectionMutation = useMutation({
    mutationFn: (collectionId: number) => removePromptFromCollection(collectionId, promptId),
    onMutate: async (collectionId: number) => {
      await queryClient.cancelQueries({ queryKey: ["collections"] });
      const previousCollections = queryClient.getQueryData<Collection[]>(["collections"]);
      queryClient.setQueryData<Collection[]>(["collections"], (current) =>
        (current ?? []).map((collection) =>
          collection.id !== collectionId
            ? collection
            : {
                ...collection,
                prompts: collection.prompts.filter((entry) => entry.prompt.id !== promptId),
              },
        ),
      );
      return { previousCollections };
    },
    onError: (_error, _collectionId, context) => {
      if (context?.previousCollections) {
        queryClient.setQueryData(["collections"], context.previousCollections);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  useEffect(() => {
    if (Number.isInteger(promptId)) {
      void logUsage(promptId, "VIEW");
      trackEvent("prompt_view", { prompt_id: promptId });
    }
  }, [promptId]);

  const launchUrl = useMemo(() => {
    const body = promptQuery.data?.body ?? "";
    return `https://chat.openai.com/?model=gpt-4o&prompt=${encodeURIComponent(body)}`;
  }, [promptQuery.data?.body]);

  if (promptQuery.isLoading) {
    return <p>Loading prompt...</p>;
  }

  if (!promptQuery.data) {
    return <p className="text-red-700">Prompt not found.</p>;
  }

  const averageRating =
    promptQuery.data.ratings && promptQuery.data.ratings.length > 0
      ? promptQuery.data.ratings.reduce((sum, item) => sum + item.value, 0) / promptQuery.data.ratings.length
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <PromptThumbnail
          title={promptQuery.data.title}
          thumbnailUrl={promptQuery.data.thumbnailUrl}
          thumbnailStatus={promptQuery.data.thumbnailStatus}
          className="h-24 w-24 rounded object-cover"
        />
        <h2 className="text-2xl font-semibold">{promptQuery.data.title}</h2>
      </div>
      <p>{promptQuery.data.summary}</p>
      <section className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">Metadata</h3>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded bg-(--color-surface-muted) px-2 py-1">Status: {promptQuery.data.status}</span>
          <span className="rounded bg-(--color-surface-muted) px-2 py-1">Visibility: {promptQuery.data.visibility}</span>
          <span className="rounded bg-(--color-surface-muted) px-2 py-1">
            Tools: {promptQuery.data.tools.length > 0 ? promptQuery.data.tools.join(", ") : "Not set"}
          </span>
          <span className="rounded bg-(--color-surface-muted) px-2 py-1">
            Modality: {promptQuery.data.modality}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {promptQuery.data.promptTags && promptQuery.data.promptTags.length > 0 ? (
            promptQuery.data.promptTags.map((item) => (
              <span key={item.tag.id} className="rounded-full bg-(--color-surface-muted) px-2 py-1 text-xs">
                #{item.tag.name}
              </span>
            ))
          ) : (
            <p className="text-sm text-(--color-text-muted)">No tags assigned.</p>
          )}
        </div>
        <div className="grid gap-2 text-sm md:grid-cols-3">
          <p className="rounded border border-(--color-border) px-3 py-2">
            <span className="font-semibold">Average rating:</span>{" "}
            {averageRating === null ? "No ratings" : averageRating.toFixed(1)}
          </p>
          <p className="rounded border border-(--color-border) px-3 py-2">
            <span className="font-semibold">Total ratings:</span> {promptQuery.data.ratings?.length ?? 0}
          </p>
          <p className="rounded border border-(--color-border) px-3 py-2">
            <span className="font-semibold">Usage events:</span> {promptQuery.data._count?.usageEvents ?? 0}
          </p>
        </div>
      </section>
      <section className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">Collections</h3>
        {collectionsQuery.isLoading ? <p className="text-sm text-(--color-text-muted)">Loading collections...</p> : null}
        {collectionsQuery.data?.length ? (
          <div className="space-y-2">
            {collectionsQuery.data.map((collection) => {
              const hasPrompt = collection.prompts.some((entry) => entry.prompt.id === promptId);
              return (
                <div
                  key={collection.id}
                  className="flex items-center justify-between rounded border border-(--color-border) px-3 py-2"
                >
                  <p className="text-sm">{collection.name}</p>
                  <button
                    type="button"
                    className="rounded border border-(--color-border) bg-(--color-surface-muted) px-2 py-1 text-xs"
                    disabled={addToCollectionMutation.isPending || removeFromCollectionMutation.isPending}
                    onClick={() => {
                      if (hasPrompt) {
                        removeFromCollectionMutation.mutate(collection.id);
                        return;
                      }
                      addToCollectionMutation.mutate(collection.id);
                    }}
                  >
                    {hasPrompt ? "Remove" : "Add"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-(--color-text-muted)">No collections available yet.</p>
        )}
      </section>
      <div>
        <Link to={`/prompts/${promptId}/edit`} className="text-sm">
          Edit prompt
        </Link>
      </div>
      <textarea
        className="h-56 w-full rounded border border-(--color-border) bg-(--color-surface) px-3 py-2"
        defaultValue={promptQuery.data.body}
        onBlur={(event) => {
          const body = event.target.value;
          if (body && body !== promptQuery.data?.body) {
            updateMutation.mutate({ body });
          }
        }}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-1.5"
          onClick={() => {
            void navigator.clipboard.writeText(promptQuery.data?.body ?? "");
            void logUsage(promptId, "COPY");
            trackEvent("prompt_copy", { prompt_id: promptId });
          }}
        >
          Copy
        </button>
        <a
          href={launchUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-1.5"
          onClick={() => {
            void logUsage(promptId, "LAUNCH");
            trackEvent("prompt_launch", { prompt_id: promptId });
          }}
        >
          Launch
        </a>
        <button
          type="button"
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-1.5"
          onClick={() => {
            void toggleFavorite(promptId);
            trackEvent("prompt_favorite_toggle", { prompt_id: promptId });
          }}
        >
          Favorite
        </button>
        <select
          value={rating}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-2"
          onChange={(event) => {
            setRating(Number(event.target.value));
          }}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value} star
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-1.5"
          onClick={() => {
            void ratePrompt(promptId, rating);
            trackEvent("prompt_rate", { prompt_id: promptId, value: rating });
          }}
        >
          Submit Rating
        </button>
      </div>
    </div>
  );
}
