import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { fetchMe } from "../auth/api";
import { addPromptToCollection, listCollections, removePromptFromCollection } from "../collections/api";
import type { Collection } from "../collections/api";
import {
  getPrompt,
  listPromptVersions,
  logUsage,
  ratePrompt,
  restorePromptVersion,
  toggleFavorite,
  updatePrompt,
} from "./api";
import { interpolatePromptBody } from "./interpolatePrompt";
import {
  defaultLaunchProviderForTools,
  getLaunchUrl,
  LAUNCH_PROVIDER_IDS,
  type LaunchProviderId,
} from "./launchProviders";
import { PromptThumbnail } from "./PromptThumbnail";
import { PromptUpdatedBadge } from "./PromptUpdatedBadge";

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function formatVersionWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function restoreErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { error?: { message?: string } } | undefined;
    if (data?.error?.message) {
      return data.error.message;
    }
  }
  return "Could not restore this version.";
}

export function PromptDetailPage() {
  const params = useParams();
  const promptId = Number(params.id);
  const [rating, setRating] = useState(5);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [launchProvider, setLaunchProvider] = useState<LaunchProviderId>("chatgpt");

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
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
  });
  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: (payload: { body: string }) => updatePrompt(promptId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prompt", promptId] });
      void queryClient.invalidateQueries({ queryKey: ["prompt", promptId, "versions"] });
    },
  });
  const versionsQuery = useQuery({
    queryKey: ["prompt", promptId, "versions"],
    queryFn: () => listPromptVersions(promptId),
    enabled: Number.isInteger(promptId) && Boolean(promptQuery.data),
  });
  const restoreMutation = useMutation({
    mutationFn: (version: number) => restorePromptVersion(promptId, version),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prompt", promptId] });
      await queryClient.invalidateQueries({ queryKey: ["prompt", promptId, "versions"] });
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

  const promptData = promptQuery.data;

  useEffect(() => {
    if (!promptData) {
      return;
    }
    setLaunchProvider(defaultLaunchProviderForTools(promptData.tools));
    const next: Record<string, string> = {};
    for (const variable of promptData.variables ?? []) {
      next[variable.key] = variable.defaultValue ?? "";
    }
    setVariableValues(next);
  }, [promptData?.id]);

  const composed = useMemo(() => {
    if (!promptData) {
      return { text: "", missingRequiredKeys: [] as string[] };
    }
    const variables = promptData.variables ?? [];
    if (variables.length === 0) {
      return { text: promptData.body, missingRequiredKeys: [] as string[] };
    }
    return interpolatePromptBody(promptData.body, variables, variableValues);
  }, [promptData, variableValues]);

  const launchUrl = useMemo(
    () => (composed.text ? getLaunchUrl(launchProvider, composed.text) : ""),
    [launchProvider, composed.text],
  );

  const hasVariables = (promptData?.variables?.length ?? 0) > 0;
  const canCopyOrLaunch = composed.missingRequiredKeys.length === 0 && composed.text.length > 0;

  useEffect(() => {
    if (Number.isInteger(promptId)) {
      void logUsage(promptId, "VIEW");
      trackEvent("prompt_view", { prompt_id: promptId });
    }
  }, [promptId]);

  if (promptQuery.isLoading) {
    return <p>Loading prompt...</p>;
  }

  if (!promptData) {
    return <p className="text-red-700">Prompt not found.</p>;
  }

  const averageRating =
    promptData.ratings && promptData.ratings.length > 0
      ? promptData.ratings.reduce((sum, item) => sum + item.value, 0) / promptData.ratings.length
      : null;

  const me = meQuery.data;
  const canRestoreVersions =
    me !== undefined &&
    (me.role === "OWNER" || me.role === "ADMIN" || (typeof promptData.ownerId === "number" && me.id === promptData.ownerId));

  const latestVersionNumber =
    versionsQuery.data && versionsQuery.data.length > 0 ? versionsQuery.data[0].version : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PromptThumbnail
          title={promptData.title}
          thumbnailUrl={promptData.thumbnailUrl}
          thumbnailStatus={promptData.thumbnailStatus}
          className="h-24 w-24 rounded object-cover"
        />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold">{promptData.title}</h2>
          <PromptUpdatedBadge createdAt={promptData.createdAt} updatedAt={promptData.updatedAt} />
        </div>
      </div>
      <p>{promptData.summary}</p>
      <section className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">Metadata</h3>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded bg-(--color-surface-muted) px-2 py-1">Status: {promptData.status}</span>
          <span className="rounded bg-(--color-surface-muted) px-2 py-1">Visibility: {promptData.visibility}</span>
          <span className="rounded bg-(--color-surface-muted) px-2 py-1">
            Tools: {promptData.tools.length > 0 ? promptData.tools.join(", ") : "Not set"}
          </span>
          <span className="rounded bg-(--color-surface-muted) px-2 py-1">Modality: {promptData.modality}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {promptData.promptTags && promptData.promptTags.length > 0 ? (
            promptData.promptTags.map((item) => (
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
            <span className="font-semibold">Total ratings:</span> {pluralize(promptData.ratings?.length ?? 0, "rating")}
          </p>
          <p className="rounded border border-(--color-border) px-3 py-2">
            <span className="font-semibold">Usage events:</span> {pluralize(promptData._count?.usageEvents ?? 0, "event")}
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

      <details className="rounded border border-(--color-border) bg-(--color-surface) p-4">
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">
          Version history
          {versionsQuery.data ? ` (${versionsQuery.data.length})` : ""}
        </summary>
        <div className="mt-3 space-y-3">
          {versionsQuery.isLoading ? <p className="text-sm text-(--color-text-muted)">Loading versions…</p> : null}
          {versionsQuery.isError ? (
            <p className="text-sm text-(--color-danger)">Failed to load version history.</p>
          ) : null}
          {restoreMutation.isError ? (
            <p className="text-sm text-(--color-danger)">{restoreErrorMessage(restoreMutation.error)}</p>
          ) : null}
          {versionsQuery.data?.map((item) => {
            const isLatest = latestVersionNumber !== null && item.version === latestVersionNumber;
            return (
              <div
                key={item.id}
                className="rounded border border-(--color-border) bg-(--color-surface-muted) p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold">v{item.version}</span>
                    {isLatest ? (
                      <span className="ml-2 rounded bg-(--color-primary) px-2 py-0.5 text-xs text-(--color-text-inverse)">
                        Latest
                      </span>
                    ) : null}
                    <span className="ml-2 text-(--color-text-muted)">{formatVersionWhen(item.createdAt)}</span>
                  </div>
                  {canRestoreVersions && !isLatest ? (
                    <button
                      type="button"
                      disabled={restoreMutation.isPending}
                      className="rounded border border-(--color-border) bg-(--color-surface) px-2 py-1 text-xs disabled:opacity-50"
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Restore version ${item.version}? The prompt body will be replaced with this snapshot.`,
                          )
                        ) {
                          return;
                        }
                        restoreMutation.mutate(item.version, {
                          onSuccess: () => {
                            trackEvent("prompt_version_restore", { prompt_id: promptId, version: item.version });
                          },
                        });
                      }}
                    >
                      Restore
                    </button>
                  ) : null}
                </div>
                {item.changelog ? (
                  <p className="mt-2 text-(--color-text-muted)">
                    <span className="font-medium text-(--color-text)">Note:</span> {item.changelog}
                  </p>
                ) : null}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-(--color-text-muted)">View body</summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-(--color-border) bg-(--color-surface) p-2 text-xs">
                    {item.body}
                  </pre>
                </details>
              </div>
            );
          })}
        </div>
      </details>

      {hasVariables ? (
        <section className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">Template</h3>
          <p className="text-xs text-(--color-text-muted)">
            Use <code className="rounded bg-(--color-surface-muted) px-1">[KEY]</code> or{" "}
            <code className="rounded bg-(--color-surface-muted) px-1">{"{{KEY}}"}</code> in the body. Fill fields below to
            preview the composed prompt.
          </p>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded border border-(--color-border) bg-(--color-surface-muted) p-3 text-sm">
            {promptData.body}
          </pre>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">Variables</h3>
          <div className="grid gap-3">
            {(promptData.variables ?? []).map((variable) => (
              <label key={variable.id} className="grid gap-1 text-sm">
                <span>
                  {variable.label || variable.key}
                  {variable.required ? <span className="text-(--color-danger)"> *</span> : null}
                </span>
                <textarea
                  className="min-h-16 w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
                  value={variableValues[variable.key] ?? ""}
                  placeholder={variable.defaultValue ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setVariableValues((current) => ({ ...current, [variable.key]: value }));
                  }}
                />
              </label>
            ))}
          </div>
          {composed.missingRequiredKeys.length > 0 ? (
            <p className="text-sm text-(--color-danger)">
              Fill required variables: {composed.missingRequiredKeys.join(", ")}
            </p>
          ) : null}
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">Preview</h3>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border border-(--color-border) bg-(--color-surface-muted) p-3 text-sm">
              {composed.text}
            </pre>
          </div>
        </section>
      ) : (
        <textarea
          className="h-56 w-full rounded border border-(--color-border) bg-(--color-surface) px-3 py-2"
          defaultValue={promptData.body}
          onBlur={(event) => {
            const body = event.target.value;
            if (body && body !== promptData.body) {
              updateMutation.mutate({ body });
            }
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-(--color-text-muted)">Open in</span>
          <select
            value={launchProvider}
            className="rounded border border-(--color-border) bg-(--color-surface-muted) px-2 py-1.5"
            onChange={(event) => {
              setLaunchProvider(event.target.value as LaunchProviderId);
            }}
          >
            {LAUNCH_PROVIDER_IDS.map((id) => (
              <option key={id} value={id}>
                {id === "chatgpt" ? "ChatGPT" : id === "claude" ? "Claude" : "Gemini"}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-1.5 disabled:opacity-50"
          disabled={!canCopyOrLaunch}
          onClick={() => {
            void navigator.clipboard.writeText(composed.text);
            void logUsage(promptId, "COPY");
            trackEvent("prompt_copy", { prompt_id: promptId });
          }}
        >
          Copy
        </button>
        <a
          href={canCopyOrLaunch ? launchUrl : undefined}
          target="_blank"
          rel="noreferrer"
          className={`rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-1.5 ${!canCopyOrLaunch ? "pointer-events-none opacity-50" : ""}`}
          aria-disabled={!canCopyOrLaunch}
          onClick={(event) => {
            if (!canCopyOrLaunch) {
              event.preventDefault();
              return;
            }
            void logUsage(promptId, "LAUNCH");
            trackEvent("prompt_launch", { prompt_id: promptId, provider: launchProvider });
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
              {pluralize(value, "star")}
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
