import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { logUsage, ratePrompt, toggleFavorite, type PromptSummary } from "./api";
import { interpolatePromptBody } from "./interpolatePrompt";
import { defaultLaunchProviderForTools, getLaunchUrl } from "./launchProviders";
import { PromptCollectionMenu } from "./PromptCollectionMenu";
import {
  CalendarIcon,
  CopyIcon,
  EyeIcon,
  HeartIcon,
  ShareIcon,
  SparkleIcon,
} from "./promptActionIcons";
import { formatPromptActivityLabel } from "./promptActivityLabel";
import { PromptAverageStars, PromptRateStars } from "./PromptStars";
import { PromptUpdatedBadge } from "./PromptUpdatedBadge";
import { buildPromptTagChips, promptOwnerAvatarUrl } from "./promptTagChips";
import { shareOrCopyPromptLink } from "./sharePrompt";

function composedTextForList(prompt: PromptSummary): { text: string; canCopyOrLaunch: boolean } {
  const variables = prompt.variables ?? [];
  if (variables.length === 0) {
    const text = prompt.body ?? "";
    return { text, canCopyOrLaunch: text.length > 0 };
  }
  const { text, missingRequiredKeys } = interpolatePromptBody(
    prompt.body ?? "",
    variables.map((v) => ({
      key: v.key,
      defaultValue: v.defaultValue,
      required: v.required,
    })),
    {},
  );
  return { text, canCopyOrLaunch: missingRequiredKeys.length === 0 && text.length > 0 };
}

type PromptListCardProps = {
  prompt: PromptSummary;
  variant?: "featured" | "default";
  showAnalytics?: boolean;
};

export function PromptListCard({ prompt, variant = "default", showAnalytics = false }: PromptListCardProps) {
  const queryClient = useQueryClient();
  const { text, canCopyOrLaunch } = composedTextForList(prompt);
  const provider = defaultLaunchProviderForTools(prompt.tools);
  const launchUrl = canCopyOrLaunch ? getLaunchUrl(provider, text) : "";

  const [myRating, setMyRating] = useState(prompt.myRating ?? null);
  const [favorited, setFavorited] = useState(prompt.favorited ?? false);

  useEffect(() => {
    setMyRating(prompt.myRating ?? null);
    setFavorited(prompt.favorited ?? false);
  }, [prompt.id, prompt.myRating, prompt.favorited]);

  const rateMutation = useMutation({
    mutationFn: (value: number) => ratePrompt(prompt.id, value),
    onSuccess: async (_, value) => {
      setMyRating(value);
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: () => toggleFavorite(prompt.id),
    onSuccess: async (data) => {
      setFavorited(data.favorited);
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
  });

  const shellClass =
    variant === "featured"
      ? "overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) p-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-(--color-primary) hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
      : "overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) p-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transform-none motion-reduce:transition-none";

  const activityLabel = formatPromptActivityLabel(prompt.createdAt, prompt.updatedAt);
  const tagChips = buildPromptTagChips({
    tools: prompt.tools,
    modality: prompt.modality,
    modelHint: prompt.modelHint,
    tagNames: prompt.tags ?? [],
  }).slice(0, 6);

  const varCount = prompt.variables?.length ?? 0;
  const useLabel = varCount > 0 ? `Use prompt (${varCount})` : "Use prompt";

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/prompts/${prompt.id}` : `/prompts/${prompt.id}`;

  return (
    <div className={shellClass}>
      <div className="p-4">
        <Link to={`/prompts/${prompt.id}`} className="block">
          <div className="flex min-w-0 items-start gap-2">
            <p
              className={
                variant === "featured" ? "min-w-0 flex-1 truncate font-semibold" : "min-w-0 flex-1 font-semibold"
              }
            >
              {prompt.title} <span className="text-(--color-text-muted)">[Prompt]</span>
            </p>
            <PromptUpdatedBadge createdAt={prompt.createdAt} updatedAt={prompt.updatedAt} />
          </div>
          <div className="mt-1">
            <PromptAverageStars value={prompt.averageRating} />
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--color-text-muted)">
            <span className="flex min-w-0 items-center gap-2">
              <img
                src={promptOwnerAvatarUrl(prompt.owner)}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full border border-(--color-border) bg-(--color-surface-muted) object-cover"
              />
              <span className="truncate font-medium text-(--color-text)">{prompt.owner.name ?? "Unknown"}</span>
            </span>
            <span className="text-(--color-border)" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              <EyeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{prompt.viewCount.toLocaleString()} views</span>
            </span>
            <span className="text-(--color-border)" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1" title={`Created ${new Date(prompt.createdAt).toLocaleString()}`}>
              <CalendarIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{activityLabel || "—"}</span>
            </span>
          </div>
          <p
            className={
              variant === "featured"
                ? "mt-2 line-clamp-2 text-sm text-(--color-text-muted)"
                : "mt-2 text-sm text-(--color-text-muted)"
            }
          >
            {prompt.summary ?? (variant === "featured" ? "No summary yet" : "No summary")}
          </p>
        </Link>

        {tagChips.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {tagChips.map((label, index) => (
              <span
                key={`${index}-${label}`}
                className="rounded-full bg-(--color-text-inverse) px-2.5 py-0.5 text-xs font-medium text-(--color-bg)"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}

        {showAnalytics ? (
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-(--color-primary)/20 bg-(--color-primary)/5 p-3 sm:grid-cols-4">
            <div className="text-center">
              <p className="text-lg font-bold text-(--color-text)">{prompt.viewCount.toLocaleString()}</p>
              <p className="text-xs text-(--color-text-muted)">Views</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-(--color-text)">{prompt.usageCount.toLocaleString()}</p>
              <p className="text-xs text-(--color-text-muted)">Uses</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-(--color-text)">
                {prompt.averageRating ? prompt.averageRating.toFixed(1) : "—"}
              </p>
              <p className="text-xs text-(--color-text-muted)">Avg Rating</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-(--color-text)">{prompt.favorited ? "Yes" : "No"}</p>
              <p className="text-xs text-(--color-text-muted)">Favorited</p>
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-(--color-text-muted)">Rate this prompt</span>
          <PromptRateStars
            value={myRating}
            disabled={rateMutation.isPending}
            onChange={(value) => {
              rateMutation.mutate(value);
              trackEvent("prompt_rate", { prompt_id: prompt.id, value });
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-(--color-border) pt-3">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              disabled={!canCopyOrLaunch}
              className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text) disabled:pointer-events-none disabled:opacity-40"
              aria-label="Copy prompt"
              onClick={() => {
                void navigator.clipboard.writeText(text);
                void logUsage(prompt.id, "COPY");
                trackEvent("prompt_copy", { prompt_id: prompt.id, source: "list" });
              }}
            >
              <CopyIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text)"
              aria-label="Share prompt link"
              onClick={() => {
                void shareOrCopyPromptLink(prompt.title, shareUrl);
                trackEvent("prompt_share", { prompt_id: prompt.id, source: "list" });
              }}
            >
              <ShareIcon className="h-5 w-5" />
            </button>
            <PromptCollectionMenu promptId={prompt.id} promptTitle={prompt.title} />
            <button
              type="button"
              disabled={favoriteMutation.isPending}
              className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text) disabled:opacity-50"
              aria-label={favorited ? "Remove favorite" : "Add favorite"}
              onClick={() => {
                favoriteMutation.mutate();
                trackEvent("prompt_favorite_toggle", { prompt_id: prompt.id, source: "list" });
              }}
            >
              <HeartIcon className="h-5 w-5" filled={favorited} />
            </button>
          </div>
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
              void logUsage(prompt.id, "LAUNCH");
              trackEvent("prompt_launch", { prompt_id: prompt.id, provider });
            }}
          >
            <SparkleIcon className="h-4 w-4" />
            {useLabel}
          </a>
        </div>

        <div className="mt-2 text-center">
          <Link
            to={`/prompts/${prompt.id}`}
            className="text-xs font-medium text-(--color-primary) hover:text-(--color-primary-hover)"
          >
            View details
          </Link>
        </div>
      </div>
    </div>
  );
}
