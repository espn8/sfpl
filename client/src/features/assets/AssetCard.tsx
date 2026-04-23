import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { useToast } from "../../app/providers/ToastProvider";
import { fetchMe } from "../auth/api";
import { type UnifiedAsset } from "./api";
import { getToolLabel } from "../prompts/api";
import { highlightMatches, truncateWithHighlight } from "../search";
import { logUsage, ratePrompt, toggleFavorite } from "../prompts/api";
import { toggleSkillFavorite, logSkillUsage } from "../skills/api";
import { toggleContextFavorite, logContextUsage } from "../context/api";
import {
  CalendarIcon,
  CopyIcon,
  EyeIcon,
  HeartIcon,
  ShareIcon,
} from "../prompts/promptActionIcons";
import { formatPromptActivityLabel } from "../prompts/promptActivityLabel";
import { promptOwnerAvatarUrl, buildPromptTagChips } from "../prompts/promptTagChips";
import { PromptAverageStars, PromptRateStars } from "../prompts/PromptStars";
import { PromptThumbnail } from "../prompts/PromptThumbnail";
import { PromptCollectionMenu } from "../prompts/PromptCollectionMenu";
import { AssetBadges } from "./badges";

type AssetCardProps = {
  asset: UnifiedAsset;
  variant?: "featured" | "default";
  showAnalytics?: boolean;
  highlightQuery?: string;
};

export function AssetCard({ asset, variant = "default", showAnalytics = false, highlightQuery = "" }: AssetCardProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [favorited, setFavorited] = useState(asset.favorited ?? false);
  const [myRating, setMyRating] = useState(asset.myRating ?? null);

  const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe });
  const isOwnAsset = Boolean(meQuery.data && meQuery.data.id === asset.owner.id);

  useEffect(() => {
    setFavorited(asset.favorited ?? false);
    setMyRating(asset.myRating ?? null);
  }, [asset.id, asset.assetType, asset.favorited, asset.myRating]);

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      if (asset.assetType === "prompt") {
        return toggleFavorite(asset.id);
      } else if (asset.assetType === "skill") {
        return toggleSkillFavorite(asset.id);
      } else {
        return toggleContextFavorite(asset.id);
      }
    },
    onSuccess: async (data) => {
      setFavorited(data.favorited);
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
      await queryClient.invalidateQueries({ queryKey: ["skills"] });
      await queryClient.invalidateQueries({ queryKey: ["context"] });
    },
  });

  const rateMutation = useMutation({
    mutationFn: (value: number) => ratePrompt(asset.id, value),
    onSuccess: async (_, value) => {
      setMyRating(value);
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
  });

  const shellClass =
    variant === "featured"
      ? "overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) p-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-(--color-primary) hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
      : "overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) p-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transform-none motion-reduce:transition-none";

  const activityLabel = formatPromptActivityLabel(asset.createdAt, asset.updatedAt);

  const assetTypeLabel = asset.assetType === "prompt" ? "Prompt" : asset.assetType === "skill" ? "Skill" : "Context";
  const detailPath = asset.assetType === "prompt" ? `/prompts/${asset.id}` : asset.assetType === "skill" ? `/skills/${asset.id}` : `/context/${asset.id}`;

  const toolChips = asset.assetType === "prompt"
    ? buildPromptTagChips({
        tools: asset.tools as Parameters<typeof buildPromptTagChips>[0]["tools"],
        modality: asset.modality ?? "text",
        modelHint: asset.modelHint,
      }).slice(0, 6)
    : asset.tools.map((tool) => getToolLabel(tool as Parameters<typeof getToolLabel>[0])).slice(0, 4);

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}${detailPath}` : detailPath;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: asset.title, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        showToast("Link copied to clipboard");
      }
      trackEvent(`${asset.assetType}_share`, { [`${asset.assetType}_id`]: asset.id, source: "list" });
    } catch {
      await navigator.clipboard.writeText(shareUrl);
      showToast("Link copied to clipboard");
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(asset.body);
    if (asset.assetType === "prompt") {
      void logUsage(asset.id, "COPY");
    } else if (asset.assetType === "skill") {
      void logSkillUsage(asset.id, "COPY");
    } else {
      void logContextUsage(asset.id, "COPY");
    }
    trackEvent(`${asset.assetType}_copy`, { [`${asset.assetType}_id`]: asset.id, source: "list" });
    showToast("Copied to clipboard");
  };

  return (
    <div className={shellClass}>
      <PromptThumbnail
        title={asset.title}
        thumbnailUrl={asset.thumbnailUrl}
        thumbnailStatus={asset.thumbnailStatus}
        className="h-40 w-full object-cover"
      />
      <div className="p-4">
        <Link to={detailPath} className="block">
          <div className="flex min-w-0 items-start gap-2">
            <p
              className={
                variant === "featured" ? "min-w-0 flex-1 truncate font-semibold" : "min-w-0 flex-1 font-semibold"
              }
            >
              {highlightQuery ? highlightMatches(asset.title, highlightQuery) : asset.title}{" "}
              <span className="text-(--color-text-muted)">[{assetTypeLabel}]</span>
            </p>
            <AssetBadges
              createdAt={asset.createdAt}
              updatedAt={asset.updatedAt}
              isSmartPick={asset.isSmartPick}
              favoriteCount={asset.favoriteCount}
            />
          </div>
          {asset.assetType === "prompt" && asset.averageRating !== undefined ? (
            <div className="mt-1">
              <PromptAverageStars value={asset.averageRating} />
            </div>
          ) : null}
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--color-text-muted)">
            <span className="flex min-w-0 items-center gap-2">
              <img
                src={promptOwnerAvatarUrl(asset.owner)}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full border border-(--color-border) bg-(--color-surface-muted) object-cover"
              />
              <span className="truncate font-medium text-(--color-text)">{asset.owner.name ?? "Unknown"}</span>
            </span>
            <span className="text-(--color-border)" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              <EyeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{asset.viewCount.toLocaleString()} views</span>
            </span>
            <span className="text-(--color-border)" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1" title={`Created ${new Date(asset.createdAt).toLocaleString()}`}>
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
            {asset.summary
              ? highlightQuery
                ? truncateWithHighlight(asset.summary, highlightQuery, 120)
                : asset.summary
              : variant === "featured"
                ? "No summary yet"
                : "No summary"}
          </p>
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
          <div className={`mt-3 grid gap-2 rounded-lg border border-(--color-primary)/20 bg-(--color-primary)/5 p-3 ${asset.assetType === "prompt" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
            <div className="text-center">
              <p className="text-lg font-bold text-(--color-text)">{asset.viewCount.toLocaleString()}</p>
              <p className="text-xs text-(--color-text-muted)">Views</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-(--color-text)">{asset.usageCount.toLocaleString()}</p>
              <p className="text-xs text-(--color-text-muted)">{asset.assetType === "prompt" ? "Uses" : "Copies"}</p>
            </div>
            {asset.assetType === "prompt" ? (
              <>
                <div className="text-center">
                  <p className="text-lg font-bold text-(--color-text)">
                    {asset.averageRating ? asset.averageRating.toFixed(1) : "—"}
                  </p>
                  <p className="text-xs text-(--color-text-muted)">Avg Rating</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-(--color-text)">{asset.favorited ? "Yes" : "No"}</p>
                  <p className="text-xs text-(--color-text-muted)">Favorited</p>
                </div>
              </>
            ) : (
              <div className="text-center">
                <p className="text-lg font-bold text-(--color-text)">{asset.favorited ? "Yes" : "No"}</p>
                <p className="text-xs text-(--color-text-muted)">Favorited</p>
              </div>
            )}
          </div>
        ) : null}

        {asset.assetType === "prompt" && !isOwnAsset ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-(--color-text-muted)">Rate this prompt</span>
            <PromptRateStars
              value={myRating}
              disabled={rateMutation.isPending}
              onChange={(value) => {
                rateMutation.mutate(value);
                trackEvent("prompt_rate", { prompt_id: asset.id, value });
              }}
            />
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-(--color-border) pt-3">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text)"
              aria-label={`Share ${asset.assetType} link`}
              onClick={handleShare}
            >
              <ShareIcon className="h-5 w-5" />
            </button>
            {asset.assetType === "prompt" ? (
              <PromptCollectionMenu promptId={asset.id} promptTitle={asset.title} />
            ) : null}
            <button
              type="button"
              disabled={favoriteMutation.isPending}
              className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text) disabled:opacity-50"
              aria-label={favorited ? "Remove favorite" : "Add favorite"}
              onClick={() => {
                favoriteMutation.mutate();
                trackEvent(`${asset.assetType}_favorite_toggle`, { [`${asset.assetType}_id`]: asset.id, source: "list" });
              }}
            >
              <HeartIcon className="h-5 w-5" filled={favorited} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={detailPath}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors bg-[#5A1BA9] text-white hover:bg-[#4A1589]"
            >
              <EyeIcon className="h-4 w-4" />
              View details
            </Link>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors bg-[#04844B] text-white hover:bg-[#036B3E]"
              aria-label={`Use ${asset.assetType}`}
              onClick={handleCopy}
            >
              <CopyIcon className="h-4 w-4" />
              Use
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
