import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { fetchMe } from "../auth/api";
import { listCollections } from "../collections/api";
import {
  getPrompt,
  getToolLabel,
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
import {
  CalendarIcon,
  CopyIcon,
  EyeIcon,
  HeartIcon,
  ShareIcon,
  SparkleIcon,
} from "./promptActionIcons";
import { PromptCollectionMenu } from "./PromptCollectionMenu";
import { formatPromptActivityLabel } from "./promptActivityLabel";
import { buildPromptTagChips, promptOwnerAvatarUrl } from "./promptTagChips";
import { PromptAverageStars, PromptRateStars } from "./PromptStars";
import { PromptThumbnail } from "./PromptThumbnail";
import { PromptUpdatedBadge } from "./PromptUpdatedBadge";
import { shareOrCopyPromptLink } from "./sharePrompt";
import { usePromptCollectionMutations } from "./usePromptCollectionMutations";

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
  const [myRating, setMyRating] = useState<number | null>(null);
  const [favorited, setFavorited] = useState(false);
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
  const { addToCollectionMutation, removeFromCollectionMutation } = usePromptCollectionMutations({
    promptId,
    promptTitle: promptQuery.data?.title,
  });
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
  const rateMutation = useMutation({
    mutationFn: (value: number) => ratePrompt(promptId, value),
    onSuccess: async (_, value) => {
      setMyRating(value);
      await queryClient.invalidateQueries({ queryKey: ["prompt", promptId] });
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
  });
  const favoriteMutation = useMutation({
    mutationFn: () => toggleFavorite(promptId),
    onSuccess: async (data) => {
      setFavorited(data.favorited);
      await queryClient.invalidateQueries({ queryKey: ["prompt", promptId] });
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
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

  useEffect(() => {
    if (!promptData) {
      return;
    }
    setMyRating(promptData.myRating ?? null);
    setFavorited(promptData.favorited ?? false);
  }, [promptData?.id, promptData?.myRating, promptData?.favorited]);

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
    return <p>Just a moment...</p>;
  }

  if (!promptData) {
    return <p className="text-red-700">This prompt doesn't exist or may have been removed.</p>;
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

  const owner =
    promptData.owner ??
    (typeof promptData.ownerId === "number"
      ? { id: promptData.ownerId, name: null, avatarUrl: null }
      : { id: 0, name: null, avatarUrl: null });
  const viewCount = promptData.viewCount ?? 0;
  const tagNames = promptData.promptTags?.map((item) => item.tag.name) ?? [];
  const detailTagChips = buildPromptTagChips({
    tools: promptData.tools,
    modality: promptData.modality,
    modelHint: promptData.modelHint,
    tagNames,
  });
  const activityLabel = formatPromptActivityLabel(promptData.createdAt, promptData.updatedAt);
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/prompts/${promptId}` : `/prompts/${promptId}`;
  const varCount = promptData.variables?.length ?? 0;
  const useLabel = varCount > 0 ? `Use prompt (${varCount})` : "Use prompt";

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface)">
        <PromptThumbnail
          title={promptData.title}
          thumbnailUrl={promptData.thumbnailUrl}
          thumbnailStatus={promptData.thumbnailStatus}
          className="h-48 w-full object-cover"
        />
        <div className="p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 id="prompt-detail-title" className="text-2xl font-semibold">
              {promptData.title}
            </h2>
          <PromptUpdatedBadge createdAt={promptData.createdAt} updatedAt={promptData.updatedAt} />
          </div>
          <div className="mt-2">
            <PromptAverageStars value={averageRating} size="md" />
          </div>
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-(--color-text-muted)">
            <span className="flex min-w-0 items-center gap-2">
              <img
                src={promptOwnerAvatarUrl(owner)}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full border border-(--color-border) bg-(--color-surface-muted) object-cover"
              />
              <span className="truncate font-medium text-(--color-text)">{owner.name ?? "Unknown"}</span>
            </span>
            <span className="text-(--color-border)" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              <EyeIcon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{viewCount.toLocaleString()} views</span>
            </span>
            <span className="text-(--color-border)" aria-hidden>
              ·
            </span>
            <span
              className="inline-flex items-center gap-1"
              title={`Created ${new Date(promptData.createdAt).toLocaleString()}`}
            >
              <CalendarIcon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{activityLabel || "—"}</span>
            </span>
          </div>
          {detailTagChips.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {detailTagChips.map((label, index) => (
                <span
                  key={`${index}-${label}`}
                  className="rounded-full bg-(--color-text-inverse) px-2.5 py-0.5 text-xs font-medium text-(--color-bg)"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-(--color-border) pt-3">
            <span className="text-sm text-(--color-text-muted)">How helpful was this prompt?</span>
            <PromptRateStars
              value={myRating}
              disabled={rateMutation.isPending}
              size="md"
              onChange={(value) => {
                rateMutation.mutate(value);
                trackEvent("prompt_rate", { prompt_id: promptId, value });
              }}
            />
          </div>
        </div>
      </div>
      {promptData.summary ? <p className="text-(--color-text-muted)">{promptData.summary}</p> : null}
      <section className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">Metadata</h3>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded bg-(--color-surface-muted) px-2 py-1">Status: {promptData.status}</span>
          <span className="rounded bg-(--color-surface-muted) px-2 py-1">Visibility: {promptData.visibility}</span>
          <span className="rounded bg-(--color-surface-muted) px-2 py-1">
            Tools: {promptData.tools.length > 0 ? promptData.tools.map(getToolLabel).join(", ") : "Not set"}
          </span>
          <span className="rounded bg-(--color-surface-muted) px-2 py-1">Generated output: {promptData.modality}</span>
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
            <span className="font-semibold">Views:</span> {viewCount.toLocaleString()}
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
          <p className="text-sm text-(--color-text-muted)">No collections yet. Create one to organize your favorites.</p>
        )}
      </section>

      {hasVariables ? (
        <section className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">Template</h3>
          <p className="text-xs text-(--color-text-muted)">
            This prompt uses variables. Fill them in below to see your customized version.
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) p-3">
        <div className="flex flex-wrap items-center gap-0.5">
          <button
            type="button"
            disabled={!canCopyOrLaunch}
            className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text) disabled:pointer-events-none disabled:opacity-40"
            aria-label="Copy prompt"
            onClick={() => {
              void navigator.clipboard.writeText(composed.text);
              void logUsage(promptId, "COPY");
              trackEvent("prompt_copy", { prompt_id: promptId, source: "detail" });
            }}
          >
            <CopyIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text)"
            aria-label="Share prompt link"
            onClick={() => {
              void shareOrCopyPromptLink(promptData.title, shareUrl);
              trackEvent("prompt_share", { prompt_id: promptId, source: "detail" });
            }}
          >
            <ShareIcon className="h-5 w-5" />
          </button>
          <PromptCollectionMenu promptId={promptId} promptTitle={promptData.title} />
          <button
            type="button"
            disabled={favoriteMutation.isPending}
            className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text) disabled:opacity-50"
            aria-label={favorited ? "Remove favorite" : "Add favorite"}
            onClick={() => {
              favoriteMutation.mutate();
              trackEvent("prompt_favorite_toggle", { prompt_id: promptId, source: "detail" });
            }}
          >
            <HeartIcon className="h-5 w-5" filled={favorited} />
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
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
          <a
            href={canCopyOrLaunch ? launchUrl : undefined}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors ${
              canCopyOrLaunch
                ? "bg-(--color-launch) text-(--color-text-inverse) hover:bg-(--color-launch-hover)"
                : "pointer-events-none bg-(--color-surface-muted) text-(--color-text-muted) opacity-50"
            }`}
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
            <SparkleIcon className="h-4 w-4" />
            {useLabel}
          </a>
        </div>
      </div>

      <div>
        <Link to={`/prompts/${promptId}/edit`} className="text-sm">
          Edit prompt
        </Link>
      </div>

      <details className="rounded border border-(--color-border) bg-(--color-surface) p-4">
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">
          History
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
    </div>
  );
}
