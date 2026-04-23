import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { buildShareUrl, shareOrCopyLink } from "../../lib/shareOrCopyLink";
import { fetchMe } from "../auth/api";
import { canCreateContent } from "../auth/roles";
import { archiveBuild, deleteBuildPermanently, getBuild, logBuildUsage, rateBuild, regenerateBuildThumbnail, toggleBuildFavorite } from "./api";
import { HeartIcon, ShareIcon } from "../prompts/promptActionIcons";
import { PromptThumbnail } from "../prompts/PromptThumbnail";
import { PromptAverageStars, PromptRateStars } from "../prompts/PromptStars";
import { AssetCollectionMenu } from "../../components/AssetCollectionMenu";

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="15 3 21 3 21 9" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="16" y1="13" x2="8" y2="13" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="16" y1="17" x2="8" y2="17" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="10 9 9 9 8 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BuildDetailPage() {
  const [favorited, setFavorited] = useState(false);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const params = useParams();
  const buildId = Number(params.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const buildQuery = useQuery({
    queryKey: ["build", buildId],
    queryFn: () => getBuild(buildId),
    enabled: Number.isInteger(buildId) && buildId > 0,
  });

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveBuild(buildId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["builds"] });
      void queryClient.invalidateQueries({ queryKey: ["build", buildId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteBuildPermanently(buildId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["builds"] });
      trackEvent("build_delete", { build_id: buildId });
      navigate("/builds");
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: () => toggleBuildFavorite(buildId),
    onSuccess: async (data) => {
      setFavorited(data.favorited);
      await queryClient.invalidateQueries({ queryKey: ["build", buildId] });
      await queryClient.invalidateQueries({ queryKey: ["builds"] });
    },
  });

  const regenerateThumbnailMutation = useMutation({
    mutationFn: () => regenerateBuildThumbnail(buildId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["build", buildId] });
      await queryClient.invalidateQueries({ queryKey: ["builds"] });
    },
  });

  const rateMutation = useMutation({
    mutationFn: (value: number) => rateBuild(buildId, value),
    onSuccess: async (_, value) => {
      setMyRating(value);
      await queryClient.invalidateQueries({ queryKey: ["build", buildId] });
      await queryClient.invalidateQueries({ queryKey: ["builds"] });
    },
  });

  useEffect(() => {
    if (buildQuery.data) {
      setFavorited(buildQuery.data.favorited ?? false);
      setMyRating(buildQuery.data.myRating ?? null);
    }
  }, [buildQuery.data?.id, buildQuery.data?.favorited, buildQuery.data?.myRating]);

  useEffect(() => {
    if (Number.isInteger(buildId) && buildId > 0) {
      void logBuildUsage(buildId, "VIEW");
      trackEvent("build_view", { build_id: buildId });
    }
  }, [buildId]);

  const build = buildQuery.data;

  if (!Number.isInteger(buildId) || buildId <= 0) {
    return <p className="text-sm text-(--color-text-muted)">Invalid build.</p>;
  }

  if (buildQuery.isLoading) {
    return <p className="text-sm text-(--color-text-muted)">Loading…</p>;
  }

  if (buildQuery.isError || !build) {
    return <p className="text-sm text-red-600">Build not found or inaccessible.</p>;
  }

  const canEdit =
    meQuery.data &&
    canCreateContent(meQuery.data.role) &&
    (meQuery.data.id === build.owner.id || meQuery.data.role === "ADMIN" || meQuery.data.role === "OWNER");
  const canDelete = meQuery.data && canCreateContent(meQuery.data.role) && meQuery.data.id === build.owner.id;
  const isOwnAsset = Boolean(meQuery.data && meQuery.data.id === build.owner.id);
  const viewCount = build.viewCount ?? 0;
  const copyCount = build.copyCount ?? 0;
  const favoriteCount = build.favoriteCount ?? 0;
  const ratingCount = build.ratingCount ?? 0;
  const averageRating = build.averageRating ?? null;

  const shareUrl = buildShareUrl(`/builds/${buildId}`);

  const handleShare = async () => {
    await shareOrCopyLink(build.title, shareUrl);
    trackEvent("build_share", { build_id: buildId, source: "detail" });
  };

  const handleOpenBuild = () => {
    void logBuildUsage(buildId, "COPY");
    trackEvent("build_open", { build_id: buildId, source: "detail" });
  };

  return (
    <article className="space-y-4">
      <div className="flex gap-4">
        <PromptThumbnail
          title={build.title}
          thumbnailUrl={build.thumbnailUrl}
          thumbnailStatus={build.thumbnailStatus}
          className="h-28 w-28 shrink-0 rounded object-cover"
          onRegenerate={canEdit ? () => regenerateThumbnailMutation.mutate() : undefined}
          isRegenerating={regenerateThumbnailMutation.isPending}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Build</p>
          <h1 className="text-2xl font-semibold">{build.title} <span className="text-(--color-text-muted)">[Build]</span></h1>
          {build.summary ? <p className="mt-1 text-(--color-text-muted)">{build.summary}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div></div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Link
              to={`/builds/${build.id}/edit`}
              className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-1.5 text-sm hover:bg-(--color-surface)"
            >
              Edit
            </Link>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className="rounded border border-amber-200 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/40"
              disabled={archiveMutation.isPending || build.status === "ARCHIVED"}
              onClick={() => {
                if (window.confirm("Archive this build?")) {
                  archiveMutation.mutate(undefined, {
                    onSuccess: () => {
                      void navigate("/builds");
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
      <p className="text-sm text-(--color-text-muted)">
        {build.status} · {build.visibility} · Owner {build.owner.name ?? `#${build.owner.id}`} · Updated{" "}
        {new Date(build.updatedAt).toLocaleString()}
      </p>
      <div className="mt-2">
        <PromptAverageStars value={averageRating} size="md" />
      </div>
      <div className="grid gap-2 text-sm md:grid-cols-4">
        <p className="rounded border border-(--color-border) px-3 py-2">
          <span className="font-semibold">Views:</span> {viewCount.toLocaleString()}
        </p>
        <p className="rounded border border-(--color-border) px-3 py-2">
          <span className="font-semibold">Opens:</span> {copyCount.toLocaleString()}
        </p>
        <p className="rounded border border-(--color-border) px-3 py-2">
          <span className="font-semibold">Favorites:</span> {favoriteCount.toLocaleString()}
        </p>
        <p className="rounded border border-(--color-border) px-3 py-2">
          <span className="font-semibold">Ratings:</span> {ratingCount.toLocaleString()}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-(--color-border) bg-(--color-surface) px-3 py-2">
        {isOwnAsset ? (
          <span className="text-sm italic text-(--color-text-muted)">
            You can't rate your own build.
          </span>
        ) : (
          <>
            <span className="text-sm text-(--color-text-muted)">How helpful was this build?</span>
            <PromptRateStars
              value={myRating}
              disabled={rateMutation.isPending}
              size="md"
              onChange={(value) => {
                rateMutation.mutate(value);
                trackEvent("build_rate", { build_id: buildId, value });
              }}
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-(--color-border) bg-(--color-surface) p-2">
        <button
          type="button"
          className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text)"
          aria-label="Share build link"
          onClick={() => void handleShare()}
        >
          <ShareIcon className="h-5 w-5" />
        </button>
        <AssetCollectionMenu assetId={buildId} assetTitle={build.title} assetType="build" />
        <button
          type="button"
          disabled={favoriteMutation.isPending}
          className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text) disabled:opacity-50"
          aria-label={favorited ? "Remove favorite" : "Add favorite"}
          onClick={() => {
            favoriteMutation.mutate();
            trackEvent("build_favorite_toggle", { build_id: buildId, source: "detail" });
          }}
        >
          <HeartIcon className="h-5 w-5" filled={favorited} />
        </button>
      </div>

      <section className="space-y-4 rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-6">
        <h2 className="text-lg font-semibold">Access this Build</h2>
        <p className="text-sm text-(--color-text-muted)">
          Builds are functional tools and applications you can use, deploy, or demo. Click below to open the build or view its documentation.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={build.buildUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-semibold shadow-sm transition-colors bg-(--color-launch) text-(--color-text-inverse) hover:bg-(--color-launch-hover)"
            onClick={handleOpenBuild}
          >
            <ExternalLinkIcon className="h-5 w-5" />
            Open Build
          </a>
          {build.supportUrl ? (
            <a
              href={build.supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-(--color-border) bg-(--color-surface) px-6 py-3 text-base font-semibold shadow-sm transition-colors hover:bg-(--color-surface-muted)"
            >
              <DocumentIcon className="h-5 w-5" />
              View Documentation
            </a>
          ) : null}
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <p>
            <span className="font-medium text-(--color-text-muted)">Build URL:</span>{" "}
            <a href={build.buildUrl} target="_blank" rel="noopener noreferrer" className="text-(--color-primary) hover:underline break-all">
              {build.buildUrl}
            </a>
          </p>
          {build.supportUrl ? (
            <p>
              <span className="font-medium text-(--color-text-muted)">Documentation:</span>{" "}
              <a href={build.supportUrl} target="_blank" rel="noopener noreferrer" className="text-(--color-primary) hover:underline break-all">
                {build.supportUrl}
              </a>
            </p>
          ) : null}
        </div>
      </section>

      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        title="Delete Build"
        assetType="build"
        assetName={build.title}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDeleteModal(false)}
      />
    </article>
  );
}
