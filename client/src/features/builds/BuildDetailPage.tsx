import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { AssetDetailActionBar } from "../../components/AssetDetailActionBar";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { normalizeUrl } from "../../lib/normalizeUrl";
import { buildShareUrl, shareOrCopyLink } from "../../lib/shareOrCopyLink";
import { fetchMe } from "../auth/api";
import { canCreateContent } from "../auth/roles";
import { archiveBuild, deleteBuildPermanently, getBuild, logBuildUsage, rateBuild, regenerateBuildThumbnail, toggleBuildFavorite } from "./api";
import { ExternalLinkIcon, HeartIcon, ShareIcon } from "../prompts/promptActionIcons";
import { PromptThumbnail } from "../prompts/PromptThumbnail";
import { PromptAverageStars, PromptRateStars } from "../prompts/PromptStars";
import { AssetCollectionMenu } from "../../components/AssetCollectionMenu";
import { VerificationBanner } from "../assets/VerificationControls";

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

  const handleOpenDocumentation = () => {
    void logBuildUsage(buildId, "COPY");
    trackEvent("build_documentation_open", { build_id: buildId, source: "detail" });
  };

  const distinctHelpUrl =
    build.supportUrl && normalizeUrl(build.supportUrl) !== normalizeUrl(build.buildUrl) ? build.supportUrl : null;

  return (
    <article className="space-y-4">
      <VerificationBanner
        assetType="build"
        assetId={buildId}
        status={build.status}
        isOwner={isOwnAsset}
        lastVerifiedAt={build.lastVerifiedAt}
        verificationDueAt={build.verificationDueAt}
        archiveReason={build.archiveReason}
      />
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

      <AssetDetailActionBar
        left={
          <>
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
          </>
        }
        primary={
          <a
            href={build.buildUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors bg-(--color-launch) text-(--color-text-inverse) hover:bg-(--color-launch-hover)"
            onClick={handleOpenBuild}
          >
            <ExternalLinkIcon className="h-4 w-4 shrink-0" />
            Open Build
          </a>
        }
        secondary={
          distinctHelpUrl ? (
            <a
              href={distinctHelpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors bg-[#5A1BA9] text-white hover:bg-[#4A1589]"
              onClick={handleOpenDocumentation}
            >
              <ExternalLinkIcon className="h-4 w-4 shrink-0" />
              Open Link
            </a>
          ) : null
        }
      />

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
