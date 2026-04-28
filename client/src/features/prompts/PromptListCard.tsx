import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { useToast } from "../../app/providers/ToastProvider";
import { fetchMe } from "../auth/api";
import { highlightMatches, truncateWithHighlight } from "../search";
import { logUsage, ratePrompt, toggleFavorite, type PromptSummary } from "./api";
import { interpolatePromptBody } from "./interpolatePrompt";
import { AssetCollectionMenu } from "../../components/AssetCollectionMenu";
import { PromptThumbnail } from "./PromptThumbnail";
import {
  CalendarIcon,
  CopyIcon,
  EyeIcon,
  HeartIcon,
  ShareIcon,
} from "./promptActionIcons";
import { formatPromptActivityLabel } from "./promptActivityLabel";
import { PromptAverageStars, PromptRateStars } from "./PromptStars";
import { buildPromptTagChips, promptOwnerAvatarUrl } from "./promptTagChips";
import { AssetBadges } from "../assets/badges";
import { VisibilityBadge } from "../assets/VisibilityBadge";
import { shareOrCopyPromptLink } from "./sharePrompt";
import { VerificationChip, VerifyAssetButton } from "../assets/VerificationControls";

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
  highlightQuery?: string;
};

export function PromptListCard({ prompt, variant = "default", showAnalytics = false, highlightQuery = "" }: PromptListCardProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { text, canCopyOrLaunch } = composedTextForList(prompt);

  const [myRating, setMyRating] = useState(prompt.myRating ?? null);
  const [favorited, setFavorited] = useState(prompt.favorited ?? false);

  const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe });
  const isOwnAsset = Boolean(meQuery.data && meQuery.data.id === prompt.owner.id);

  useEffect(() => {
    setMyRating(prompt.myRating ?? null);
    setFavorited(prompt.favorited ?? false);
  }, [prompt.id, prompt.myRating, prompt.favorited]);

  const rateMutation = useMutation({
    mutationFn: (args: { value: number; feedbackFlags?: string[] }) =>
      ratePrompt(prompt.id, args.value, { feedbackFlags: args.feedbackFlags }),
    onSuccess: async (_, args) => {
      setMyRating(args.value);
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
      ? "rounded-xl border border-(--color-border) bg-(--color-surface) p-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-(--color-primary) hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
      : "rounded-xl border border-(--color-border) bg-(--color-surface) p-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transform-none motion-reduce:transition-none";

  const activityLabel = formatPromptActivityLabel(prompt.createdAt, prompt.updatedAt);
  const tagChips = buildPromptTagChips({
    tools: prompt.tools,
    modality: prompt.modality,
    modelHint: prompt.modelHint,
  }).slice(0, 6);

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/prompts/${prompt.id}` : `/prompts/${prompt.id}`;

  return (
    <div className={shellClass}>
      <div className="hidden overflow-hidden rounded-t-xl md:block">
        <PromptThumbnail
          title={prompt.title}
          thumbnailUrl={prompt.thumbnailUrl}
          thumbnailStatus={prompt.thumbnailStatus}
          className="h-40 w-full object-cover"
        />
      </div>
      <div className="max-md:rounded-t-xl rounded-b-xl p-4">
        <Link to={`/prompts/${prompt.id}`} className="block">
          <div className="flex min-w-0 items-start gap-2">
            <p
              className={
                variant === "featured" ? "min-w-0 flex-1 truncate font-semibold" : "min-w-0 flex-1 font-semibold"
              }
            >
              {highlightQuery ? highlightMatches(prompt.title, highlightQuery) : prompt.title}{" "}
              <span className="text-(--color-text-muted)">[Prompt]</span>
            </p>
            <span className="inline-flex shrink-0 items-center gap-1.5">
              <VisibilityBadge visibility={prompt.visibility} />
              <AssetBadges
                createdAt={prompt.createdAt}
                updatedAt={prompt.updatedAt}
                isSmartPick={prompt.isSmartPick}
                favoriteCount={prompt.favoriteCount}
              />
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <PromptAverageStars
              value={prompt.averageRating}
              ratingCount={prompt.ratingCount}
              flagCounts={prompt.flagCounts}
            />
            <VerificationChip
              status={prompt.status}
              lastVerifiedAt={prompt.lastVerifiedAt}
              verificationDueAt={prompt.verificationDueAt}
              archiveReason={prompt.archiveReason}
            />
          </div>
        </Link>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--color-text-muted)">
          <Link
            to={`/users/${prompt.owner.id}`}
            className="flex min-w-0 max-w-full items-center gap-2 rounded outline-none hover:text-(--color-primary) focus-visible:ring-2 focus-visible:ring-(--color-primary)"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={promptOwnerAvatarUrl(prompt.owner)}
              alt=""
              className="h-7 w-7 shrink-0 rounded-full border border-(--color-border) bg-(--color-surface-muted) object-cover"
            />
            <span className="truncate font-medium text-(--color-text)">{prompt.owner.name ?? "Unknown"}</span>
          </Link>
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
        <Link to={`/prompts/${prompt.id}`} className="block">
          <p
            className="mt-2 line-clamp-2 text-sm text-(--color-text-muted)"
          >
            {prompt.summary
              ? highlightQuery
                ? truncateWithHighlight(prompt.summary, highlightQuery, 120)
                : prompt.summary
              : variant === "featured"
                ? "No summary yet"
                : "No summary"}
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

        {isOwnAsset ? (
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <VerifyAssetButton
              assetType="prompt"
              assetId={prompt.id}
              status={prompt.status}
              verificationDueAt={prompt.verificationDueAt}
              compact
            />
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-(--color-text-muted)">Rate this prompt</span>
            <PromptRateStars
              value={myRating}
              disabled={rateMutation.isPending}
              onChange={(value, extras) => {
                rateMutation.mutate({ value, feedbackFlags: extras?.feedbackFlags });
                trackEvent("prompt_rate", { prompt_id: prompt.id, value });
              }}
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-(--color-border) pt-3">
          <div className="flex items-center gap-0.5">
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
            <AssetCollectionMenu assetId={prompt.id} assetTitle={prompt.title} assetType="prompt" />
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
          <div className="flex items-center gap-2">
            <Link
              to={`/prompts/${prompt.id}`}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors bg-(--color-launch) text-(--color-text-inverse) hover:bg-(--color-launch-hover)"
            >
              <EyeIcon className="h-4 w-4" />
              View details
            </Link>
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
                void navigator.clipboard.writeText(text);
                void logUsage(prompt.id, "COPY");
                trackEvent("prompt_copy", { prompt_id: prompt.id, source: "list" });
                showToast("Copied to clipboard");
              }}
            >
              <CopyIcon className="h-4 w-4" />
              Copy
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
