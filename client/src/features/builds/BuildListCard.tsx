import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { useToast } from "../../app/providers/ToastProvider";
import { fetchMe } from "../auth/api";
import { logBuildUsage, rateBuild, toggleBuildFavorite, type Build } from "./api";
import {
  CalendarIcon,
  EyeIcon,
  HeartIcon,
  ShareIcon,
} from "../prompts/promptActionIcons";
import { formatPromptActivityLabel } from "../prompts/promptActivityLabel";
import { promptOwnerAvatarUrl } from "../prompts/promptTagChips";
import { PromptAverageStars, PromptRateStars } from "../prompts/PromptStars";
import { AssetBadges } from "../assets/badges";

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="15 3 21 3 21 9" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type BuildListCardProps = {
  build: Build;
  variant?: "featured" | "default";
  showAnalytics?: boolean;
};

export function BuildListCard({ build, variant = "default", showAnalytics = false }: BuildListCardProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [favorited, setFavorited] = useState(build.favorited ?? false);
  const [myRating, setMyRating] = useState<number | null>(build.myRating ?? null);

  const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe });
  const isOwnAsset = Boolean(meQuery.data && meQuery.data.id === build.owner.id);

  useEffect(() => {
    setFavorited(build.favorited ?? false);
    setMyRating(build.myRating ?? null);
  }, [build.id, build.favorited, build.myRating]);

  const favoriteMutation = useMutation({
    mutationFn: () => toggleBuildFavorite(build.id),
    onSuccess: async (data) => {
      setFavorited(data.favorited);
      await queryClient.invalidateQueries({ queryKey: ["builds"] });
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });

  const rateMutation = useMutation({
    mutationFn: (value: number) => rateBuild(build.id, value),
    onSuccess: async (_, value) => {
      setMyRating(value);
      await queryClient.invalidateQueries({ queryKey: ["builds"] });
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });

  const shellClass =
    variant === "featured"
      ? "overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) p-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-(--color-primary) hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
      : "overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) p-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transform-none motion-reduce:transition-none";

  const activityLabel = formatPromptActivityLabel(build.createdAt, build.updatedAt);

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/builds/${build.id}` : `/builds/${build.id}`;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: build.title, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        showToast("Link copied to clipboard");
      }
      trackEvent("build_share", { build_id: build.id, source: "list" });
    } catch {
      await navigator.clipboard.writeText(shareUrl);
      showToast("Link copied to clipboard");
    }
  };

  const handleOpenBuild = () => {
    void logBuildUsage(build.id, "COPY");
    trackEvent("build_open", { build_id: build.id, source: "list" });
  };

  return (
    <div className={shellClass}>
      <div className="p-4">
        <Link to={`/builds/${build.id}`} className="block">
          <div className="flex min-w-0 items-start gap-2">
            <p
              className={
                variant === "featured" ? "min-w-0 flex-1 truncate font-semibold" : "min-w-0 flex-1 font-semibold"
              }
            >
              {build.title} <span className="text-(--color-text-muted)">[Build]</span>
            </p>
            <AssetBadges
              createdAt={build.createdAt}
              updatedAt={build.updatedAt}
              isSmartPick={build.isSmartPick}
              favoriteCount={build.favoriteCount}
            />
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--color-text-muted)">
            <span className="flex min-w-0 items-center gap-2">
              <img
                src={promptOwnerAvatarUrl(build.owner)}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full border border-(--color-border) bg-(--color-surface-muted) object-cover"
              />
              <span className="truncate font-medium text-(--color-text)">{build.owner.name ?? "Unknown"}</span>
            </span>
            <span className="text-(--color-border)" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              <EyeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{(build.viewCount ?? 0).toLocaleString()} views</span>
            </span>
            <span className="text-(--color-border)" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1" title={`Created ${new Date(build.createdAt).toLocaleString()}`}>
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
            {build.summary ?? (variant === "featured" ? "No summary yet" : "No summary")}
          </p>
          <div className="mt-2">
            <PromptAverageStars value={build.averageRating ?? null} size="sm" />
          </div>
        </Link>

        {showAnalytics ? (
          <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg border border-(--color-primary)/20 bg-(--color-primary)/5 p-3">
            <div className="text-center">
              <p className="text-lg font-bold text-(--color-text)">{(build.viewCount ?? 0).toLocaleString()}</p>
              <p className="text-xs text-(--color-text-muted)">Views</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-(--color-text)">{(build.copyCount ?? 0).toLocaleString()}</p>
              <p className="text-xs text-(--color-text-muted)">Opens</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-(--color-text)">{(build.favoriteCount ?? 0).toLocaleString()}</p>
              <p className="text-xs text-(--color-text-muted)">Favorites</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-(--color-text)">{(build.ratingCount ?? 0).toLocaleString()}</p>
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
                trackEvent("build_rate", { build_id: build.id, value, source: "list" });
              }}
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-(--color-border) pt-3">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text)"
              aria-label="Share build link"
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
                trackEvent("build_favorite_toggle", { build_id: build.id, source: "list" });
              }}
            >
              <HeartIcon className="h-5 w-5" filled={favorited} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/builds/${build.id}`}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors bg-(--color-surface-muted) text-(--color-text) hover:bg-(--color-border)"
            >
              <EyeIcon className="h-4 w-4" />
              View details
            </Link>
            <a
              href={build.buildUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors bg-(--color-launch) text-(--color-text-inverse) hover:bg-(--color-launch-hover)"
              onClick={handleOpenBuild}
            >
              <ExternalLinkIcon className="h-4 w-4" />
              Open Build
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
