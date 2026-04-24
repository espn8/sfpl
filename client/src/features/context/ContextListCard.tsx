import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { useToast } from "../../app/providers/ToastProvider";
import { fetchMe } from "../auth/api";
import { logContextUsage, rateContext, toggleContextFavorite, type ContextDocument } from "./api";
import { getToolLabel } from "../prompts/api";
import {
  CalendarIcon,
  CopyIcon,
  EyeIcon,
  HeartIcon,
  ShareIcon,
} from "../prompts/promptActionIcons";
import { formatPromptActivityLabel } from "../prompts/promptActivityLabel";
import { promptOwnerAvatarUrl } from "../prompts/promptTagChips";
import { PromptAverageStars, PromptRateStars } from "../prompts/PromptStars";
import { PromptThumbnail } from "../prompts/PromptThumbnail";
import { AssetBadges } from "../assets/badges";

type ContextListCardProps = {
  context: ContextDocument;
  variant?: "featured" | "default";
  showAnalytics?: boolean;
};

export function ContextListCard({ context, variant = "default", showAnalytics = false }: ContextListCardProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [favorited, setFavorited] = useState(context.favorited ?? false);
  const [myRating, setMyRating] = useState<number | null>(context.myRating ?? null);

  const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe });
  const isOwnAsset = Boolean(meQuery.data && meQuery.data.id === context.owner.id);

  useEffect(() => {
    setFavorited(context.favorited ?? false);
    setMyRating(context.myRating ?? null);
  }, [context.id, context.favorited, context.myRating]);

  const favoriteMutation = useMutation({
    mutationFn: () => toggleContextFavorite(context.id),
    onSuccess: async (data) => {
      setFavorited(data.favorited);
      await queryClient.invalidateQueries({ queryKey: ["context"] });
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });

  const rateMutation = useMutation({
    mutationFn: (value: number) => rateContext(context.id, value),
    onSuccess: async (_, value) => {
      setMyRating(value);
      await queryClient.invalidateQueries({ queryKey: ["context"] });
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });

  const shellClass =
    variant === "featured"
      ? "overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) p-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-(--color-primary) hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
      : "overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) p-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transform-none motion-reduce:transition-none";

  const activityLabel = formatPromptActivityLabel(context.createdAt, context.updatedAt);

  const toolChips = context.tools.map((tool) => getToolLabel(tool as Parameters<typeof getToolLabel>[0])).slice(0, 4);

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/context/${context.id}` : `/context/${context.id}`;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: context.title, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        showToast("Link copied to clipboard");
      }
      trackEvent("context_share", { context_id: context.id, source: "list" });
    } catch {
      await navigator.clipboard.writeText(shareUrl);
      showToast("Link copied to clipboard");
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(context.body);
    void logContextUsage(context.id, "COPY");
    trackEvent("context_copy", { context_id: context.id, source: "list" });
    showToast("Copied to clipboard");
  };

  return (
    <div className={shellClass}>
      <div className="hidden md:block">
        <PromptThumbnail
          title={context.title}
          thumbnailUrl={context.thumbnailUrl}
          thumbnailStatus={context.thumbnailStatus}
          className="h-40 w-full object-cover"
        />
      </div>
      <div className="p-4">
        <Link to={`/context/${context.id}`} className="block">
          <div className="flex min-w-0 items-start gap-2">
            <p
              className={
                variant === "featured" ? "min-w-0 flex-1 truncate font-semibold" : "min-w-0 flex-1 font-semibold"
              }
            >
              {context.title} <span className="text-(--color-text-muted)">[Context]</span>
            </p>
            <AssetBadges
              createdAt={context.createdAt}
              updatedAt={context.updatedAt}
              isSmartPick={context.isSmartPick}
              favoriteCount={context.favoriteCount}
            />
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--color-text-muted)">
            <span className="flex min-w-0 items-center gap-2">
              <img
                src={promptOwnerAvatarUrl(context.owner)}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full border border-(--color-border) bg-(--color-surface-muted) object-cover"
              />
              <span className="truncate font-medium text-(--color-text)">{context.owner.name ?? "Unknown"}</span>
            </span>
            <span className="text-(--color-border)" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              <EyeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{(context.viewCount ?? 0).toLocaleString()} views</span>
            </span>
            <span className="text-(--color-border)" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1" title={`Created ${new Date(context.createdAt).toLocaleString()}`}>
              <CalendarIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{activityLabel || "—"}</span>
            </span>
          </div>
          <p
            className="mt-2 line-clamp-2 text-sm text-(--color-text-muted)"
          >
            {context.summary ?? (variant === "featured" ? "No summary yet" : "No summary")}
          </p>
          <div className="mt-2">
            <PromptAverageStars value={context.averageRating ?? null} size="sm" />
          </div>
        </Link>

        {toolChips.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {toolChips.map((label, index) => (
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
          <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg border border-(--color-primary)/20 bg-(--color-primary)/5 p-3">
            <div className="text-center">
              <p className="text-lg font-bold text-(--color-text)">{(context.viewCount ?? 0).toLocaleString()}</p>
              <p className="text-xs text-(--color-text-muted)">Views</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-(--color-text)">{(context.copyCount ?? 0).toLocaleString()}</p>
              <p className="text-xs text-(--color-text-muted)">Copies</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-(--color-text)">{(context.favoriteCount ?? 0).toLocaleString()}</p>
              <p className="text-xs text-(--color-text-muted)">Favorites</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-(--color-text)">{(context.ratingCount ?? 0).toLocaleString()}</p>
              <p className="text-xs text-(--color-text-muted)">Ratings</p>
            </div>
          </div>
        ) : null}

        {isOwnAsset ? null : (
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-(--color-border) pt-3">
            <span className="text-xs text-(--color-text-muted)">Rate:</span>
            <PromptRateStars
              value={myRating}
              disabled={rateMutation.isPending}
              size="sm"
              onChange={(value) => {
                rateMutation.mutate(value);
                trackEvent("context_rate", { context_id: context.id, value, source: "list" });
              }}
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-(--color-border) pt-3">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text)"
              aria-label="Share context link"
              onClick={handleShare}
            >
              <ShareIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              disabled={favoriteMutation.isPending}
              className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text) disabled:opacity-50"
              aria-label={favorited ? "Remove favorite" : "Add favorite"}
              onClick={() => {
                favoriteMutation.mutate();
                trackEvent("context_favorite_toggle", { context_id: context.id, source: "list" });
              }}
            >
              <HeartIcon className="h-5 w-5" filled={favorited} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/context/${context.id}`}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors bg-(--color-launch) text-(--color-text-inverse) hover:bg-(--color-launch-hover)"
            >
              <EyeIcon className="h-4 w-4" />
              View details
            </Link>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors bg-[#5A1BA9] text-white hover:bg-[#4A1589]"
              aria-label="Copy context"
              onClick={handleCopy}
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
