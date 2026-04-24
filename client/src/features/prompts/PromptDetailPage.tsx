import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { useToast } from "../../app/providers/ToastProvider";
import { AssetCollectionMenu } from "../../components/AssetCollectionMenu";
import { AssetDetailActionBar } from "../../components/AssetDetailActionBar";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { buildShareUrl, shareOrCopyLink } from "../../lib/shareOrCopyLink";
import { fetchMe } from "../auth/api";
import { canCreateContent } from "../auth/roles";
import {
  archivePrompt,
  deletePromptPermanently,
  getPrompt,
  listPromptVersions,
  logUsage,
  ratePrompt,
  regeneratePromptThumbnail,
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
import { CopyIcon, HeartIcon, ShareIcon, SparkleIcon } from "./promptActionIcons";
import { buildPromptTagChips } from "./promptTagChips";
import { PromptAverageStars, PromptRateStars } from "./PromptStars";
import { PromptThumbnail } from "./PromptThumbnail";
import { AssetBadges } from "../assets/badges";
import { VerificationBanner } from "../assets/VerificationControls";

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
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [myRating, setMyRating] = useState<number | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [launchProvider, setLaunchProvider] = useState<LaunchProviderId>("chatgpt");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const promptQuery = useQuery({
    queryKey: ["prompt", promptId],
    queryFn: () => getPrompt(promptId),
    enabled: Number.isInteger(promptId) && promptId > 0,
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
    enabled: Number.isInteger(promptId) && promptId > 0 && Boolean(promptQuery.data),
  });
  const restoreMutation = useMutation({
    mutationFn: (version: number) => restorePromptVersion(promptId, version),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prompt", promptId] });
      await queryClient.invalidateQueries({ queryKey: ["prompt", promptId, "versions"] });
    },
  });
  const rateMutation = useMutation({
    mutationFn: (args: { value: number; feedbackFlags?: string[] }) =>
      ratePrompt(promptId, args.value, { feedbackFlags: args.feedbackFlags }),
    onSuccess: async (_, args) => {
      setMyRating(args.value);
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
  const archiveMutation = useMutation({
    mutationFn: () => archivePrompt(promptId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
      trackEvent("prompt_archive", { prompt_id: promptId });
      navigate("/");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deletePromptPermanently(promptId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
      trackEvent("prompt_delete", { prompt_id: promptId });
      navigate("/");
    },
  });
  const regenerateMutation = useMutation({
    mutationFn: () => regeneratePromptThumbnail(promptId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prompt", promptId] });
      void queryClient.invalidateQueries({ queryKey: ["prompts"] });
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
    if (Number.isInteger(promptId) && promptId > 0) {
      void logUsage(promptId, "VIEW");
      trackEvent("prompt_view", { prompt_id: promptId });
    }
  }, [promptId]);

  if (!Number.isInteger(promptId) || promptId <= 0) {
    return <p className="text-sm text-(--color-text-muted)">Invalid prompt.</p>;
  }

  if (promptQuery.isLoading) {
    return <p className="text-sm text-(--color-text-muted)">Loading…</p>;
  }

  if (promptQuery.isError || !promptData) {
    return <p className="text-sm text-red-600">This prompt doesn't exist or may have been removed.</p>;
  }

  const averageRating =
    promptData.ratings && promptData.ratings.length > 0
      ? promptData.ratings.reduce((sum, item) => sum + item.value, 0) / promptData.ratings.length
      : null;

  const me = meQuery.data;
  const ownerUserId =
    typeof promptData.owner?.id === "number"
      ? promptData.owner.id
      : typeof promptData.ownerId === "number"
        ? promptData.ownerId
        : undefined;
  const canEdit =
    me &&
    canCreateContent(me.role) &&
    (me.role === "OWNER" || me.role === "ADMIN" || (typeof ownerUserId === "number" && me.id === ownerUserId));
  const canDelete = me && canCreateContent(me.role) && typeof ownerUserId === "number" && me.id === ownerUserId;
  const canRestoreVersions = canEdit;
  const isOwnAsset = Boolean(me && typeof ownerUserId === "number" && me.id === ownerUserId);

  const latestVersionNumber =
    versionsQuery.data && versionsQuery.data.length > 0 ? versionsQuery.data[0].version : null;

  const owner =
    promptData.owner ??
    (typeof promptData.ownerId === "number"
      ? { id: promptData.ownerId, name: null, avatarUrl: null }
      : { id: 0, name: null, avatarUrl: null });
  const viewCount = promptData.viewCount ?? 0;
  const detailTagChips = buildPromptTagChips({
    tools: promptData.tools,
    modality: promptData.modality,
    modelHint: promptData.modelHint,
  });
  const shareUrl = buildShareUrl(`/prompts/${promptId}`);
  const varCount = promptData.variables?.length ?? 0;
  const useLabel = varCount > 0 ? `Use prompt (${varCount})` : "Use prompt";

  const handleShare = async () => {
    await shareOrCopyLink(promptData.title, shareUrl);
    trackEvent("prompt_share", { prompt_id: promptId, source: "detail" });
  };

  return (
    <article className="space-y-4">
      <VerificationBanner
        assetType="prompt"
        assetId={promptId}
        status={promptData.status}
        isOwner={isOwnAsset}
        lastVerifiedAt={promptData.lastVerifiedAt}
        verificationDueAt={promptData.verificationDueAt}
        archiveReason={promptData.archiveReason}
      />
      <div className="flex gap-4">
        <PromptThumbnail
          title={promptData.title}
          thumbnailUrl={promptData.thumbnailUrl}
          thumbnailStatus={promptData.thumbnailStatus}
          className="h-28 w-28 shrink-0 rounded object-cover"
          onRegenerate={canEdit ? () => regenerateMutation.mutate() : undefined}
          isRegenerating={regenerateMutation.isPending}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Prompt</p>
          <div className="flex items-start gap-2">
            <h1 id="prompt-detail-title" className="text-2xl font-semibold">
              {promptData.title} <span className="text-(--color-text-muted)">[Prompt]</span>
            </h1>
            <AssetBadges
              createdAt={promptData.createdAt}
              updatedAt={promptData.updatedAt}
              isSmartPick={promptData.isSmartPick}
              favoriteCount={promptData.favoriteCount}
            />
          </div>
          {promptData.summary ? <p className="mt-1 text-(--color-text-muted)">{promptData.summary}</p> : null}
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
        </div>
      </div>
      {canEdit || canDelete ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div></div>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Link
                to={`/prompts/${promptId}/edit`}
                className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-1.5 text-sm hover:bg-(--color-surface)"
              >
                Edit
              </Link>
            ) : null}
            {canEdit ? (
              <button
                type="button"
                className="rounded border border-amber-200 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/40"
                disabled={archiveMutation.isPending || promptData.status === "ARCHIVED"}
                onClick={() => {
                  if (window.confirm("Archive this prompt?")) {
                    archiveMutation.mutate(undefined, {
                      onError: () => {
                        showToast("Could not archive this prompt.");
                      },
                    });
                  }
                }}
              >
                Archive
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                onClick={() => setShowDeleteModal(true)}
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <p className="text-sm text-(--color-text-muted)">
        {promptData.status} · {promptData.visibility} · Owner {owner.name ?? `#${owner.id}`} ·{" "}
        {viewCount.toLocaleString()} views · Updated {new Date(promptData.updatedAt).toLocaleString()}
      </p>
      <div className="mt-2">
        <PromptAverageStars
          value={averageRating}
          size="md"
          ratingCount={promptData.ratings?.length ?? 0}
          flagCounts={promptData.flagCounts}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-(--color-border) bg-(--color-surface) px-3 py-2">
        {isOwnAsset ? (
          <span className="text-sm italic text-(--color-text-muted)">You can't rate your own prompt.</span>
        ) : (
          <>
            <span className="text-sm text-(--color-text-muted)">How helpful was this prompt?</span>
            <PromptRateStars
              value={myRating}
              disabled={rateMutation.isPending}
              size="md"
              showFlags
              onChange={(value, extras) => {
                rateMutation.mutate({ value, feedbackFlags: extras?.feedbackFlags });
                trackEvent("prompt_rate", { prompt_id: promptId, value });
              }}
            />
          </>
        )}
      </div>

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

      <AssetDetailActionBar
        left={
          <>
            <button
              type="button"
              className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text)"
              aria-label="Share prompt link"
              onClick={() => void handleShare()}
            >
              <ShareIcon className="h-5 w-5" />
            </button>
            <AssetCollectionMenu assetId={promptId} assetTitle={promptData.title} assetType="prompt" />
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
          </>
        }
        openIn={
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
        }
        primary={
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
        }
        secondary={
          <button
            type="button"
            disabled={!canCopyOrLaunch}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors ${
              canCopyOrLaunch
                ? "bg-[#5A1BA9] text-white hover:bg-[#4A1589]"
                : "pointer-events-none bg-(--color-surface-muted) text-(--color-text-muted) opacity-50"
            }`}
            aria-label="Copy prompt"
            onClick={() => {
              void navigator.clipboard.writeText(composed.text);
              void logUsage(promptId, "COPY");
              trackEvent("prompt_copy", { prompt_id: promptId, source: "detail" });
              showToast("Copied to clipboard");
            }}
          >
            <CopyIcon className="h-4 w-4" />
            Copy
          </button>
        }
      />

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

      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        title="Delete Prompt"
        assetType="prompt"
        assetName={promptData.title}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDeleteModal(false)}
      />
    </article>
  );
}
