import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { useToast } from "../../app/providers/ToastProvider";
import { AssetDetailActionBar } from "../../components/AssetDetailActionBar";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { normalizeUrl } from "../../lib/normalizeUrl";
import { buildShareUrl, copyToClipboard, shareOrCopyLink } from "../../lib/shareOrCopyLink";
import { fetchMe } from "../auth/api";
import { canCreateContent } from "../auth/roles";
import { archiveSkill, deleteSkillPermanently, getSkill, logSkillUsage, rateSkill, regenerateSkillThumbnail, toggleSkillFavorite, getSkillToolLabel } from "./api";
import { CopyIcon, ExternalLinkIcon, HeartIcon, ShareIcon } from "../prompts/promptActionIcons";
import { PromptThumbnail } from "../prompts/PromptThumbnail";
import { PromptAverageStars, PromptRateStars } from "../prompts/PromptStars";
import { AssetCollectionMenu } from "../../components/AssetCollectionMenu";
import { AssetBadges } from "../assets/badges";
import { VerificationBanner } from "../assets/VerificationControls";

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

export function SkillDetailPage() {
  const [favorited, setFavorited] = useState(false);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { showToast } = useToast();
  const params = useParams();
  const skillId = Number(params.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const skillQuery = useQuery({
    queryKey: ["skill", skillId],
    queryFn: () => getSkill(skillId),
    enabled: Number.isInteger(skillId) && skillId > 0,
  });

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveSkill(skillId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["skills"] });
      void queryClient.invalidateQueries({ queryKey: ["skill", skillId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSkillPermanently(skillId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["skills"] });
      trackEvent("skill_delete", { skill_id: skillId });
      navigate("/skills");
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: () => toggleSkillFavorite(skillId),
    onSuccess: async (data) => {
      setFavorited(data.favorited);
      await queryClient.invalidateQueries({ queryKey: ["skill", skillId] });
      await queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });

  const regenerateThumbnailMutation = useMutation({
    mutationFn: () => regenerateSkillThumbnail(skillId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["skill", skillId] });
      await queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });

  const rateMutation = useMutation({
    mutationFn: (value: number) => rateSkill(skillId, value),
    onSuccess: async (_, value) => {
      setMyRating(value);
      await queryClient.invalidateQueries({ queryKey: ["skill", skillId] });
      await queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });

  useEffect(() => {
    if (skillQuery.data) {
      setFavorited(skillQuery.data.favorited ?? false);
      setMyRating(skillQuery.data.myRating ?? null);
    }
  }, [skillQuery.data?.id, skillQuery.data?.favorited, skillQuery.data?.myRating]);

  useEffect(() => {
    if (Number.isInteger(skillId) && skillId > 0) {
      void logSkillUsage(skillId, "VIEW");
      trackEvent("skill_view", { skill_id: skillId });
    }
  }, [skillId]);

  const skill = skillQuery.data;

  if (!Number.isInteger(skillId) || skillId <= 0) {
    return <p className="text-sm text-(--color-text-muted)">Invalid skill.</p>;
  }

  if (skillQuery.isLoading) {
    return <p className="text-sm text-(--color-text-muted)">Loading…</p>;
  }

  if (skillQuery.isError || !skill) {
    return <p className="text-sm text-red-600">Skill not found or inaccessible.</p>;
  }

  const canEdit =
    meQuery.data &&
    canCreateContent(meQuery.data.role) &&
    (meQuery.data.id === skill.owner.id || meQuery.data.role === "ADMIN" || meQuery.data.role === "OWNER");
  const canDelete = meQuery.data && canCreateContent(meQuery.data.role) && meQuery.data.id === skill.owner.id;
  const isOwnAsset = Boolean(meQuery.data && meQuery.data.id === skill.owner.id);
  const averageRating = skill.averageRating ?? null;

  const shareUrl = buildShareUrl(`/skills/${skillId}`);

  const handleShare = async () => {
    await shareOrCopyLink(skill.title, shareUrl);
    trackEvent("skill_share", { skill_id: skillId, source: "detail" });
  };

  const handleDownloadSkill = () => {
    void logSkillUsage(skillId, "COPY");
    trackEvent("skill_download", { skill_id: skillId, source: "detail" });
  };

  const handleCopyPageLink = async () => {
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      showToast("Copied link");
      trackEvent("skill_copy_link", { skill_id: skillId, source: "detail" });
    }
  };

  const distinctHelpUrl =
    skill.supportUrl && normalizeUrl(skill.supportUrl) !== normalizeUrl(skill.skillUrl) ? skill.supportUrl : null;

  return (
    <article className="space-y-4">
      <VerificationBanner
        assetType="skill"
        assetId={skillId}
        status={skill.status}
        isOwner={isOwnAsset}
        lastVerifiedAt={skill.lastVerifiedAt}
        verificationDueAt={skill.verificationDueAt}
        archiveReason={skill.archiveReason}
      />
      <div className="flex gap-4">
        <PromptThumbnail
          title={skill.title}
          thumbnailUrl={skill.thumbnailUrl}
          thumbnailStatus={skill.thumbnailStatus}
          className="h-28 w-28 shrink-0 rounded object-cover"
          onRegenerate={canEdit ? () => regenerateThumbnailMutation.mutate() : undefined}
          isRegenerating={regenerateThumbnailMutation.isPending}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Skill</p>
          <div className="flex items-start gap-2">
            <h1 className="text-2xl font-semibold">{skill.title} <span className="text-(--color-text-muted)">[Skill]</span></h1>
            <AssetBadges
              createdAt={skill.createdAt}
              updatedAt={skill.updatedAt}
              isSmartPick={skill.isSmartPick}
              favoriteCount={skill.favoriteCount}
            />
          </div>
          {skill.summary ? <p className="mt-1 text-(--color-text-muted)">{skill.summary}</p> : null}
          {skill.tools.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {skill.tools.map((tool) => (
                <span
                  key={tool}
                  className="rounded-full bg-(--color-text-inverse) px-2.5 py-0.5 text-xs font-medium text-(--color-bg)"
                >
                  {getSkillToolLabel(tool)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div></div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Link
              to={`/skills/${skill.id}/edit`}
              className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-1.5 text-sm hover:bg-(--color-surface)"
            >
              Edit
            </Link>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className="rounded border border-amber-200 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/40"
              disabled={archiveMutation.isPending || skill.status === "ARCHIVED"}
              onClick={() => {
                if (window.confirm("Archive this skill?")) {
                  archiveMutation.mutate(undefined, {
                    onSuccess: () => {
                      void navigate("/skills");
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
        {skill.status} · {skill.visibility} · Owner {skill.owner.name ?? `#${skill.owner.id}`} · Updated{" "}
        {new Date(skill.updatedAt).toLocaleString()}
      </p>
      <div className="mt-2">
        <PromptAverageStars value={averageRating} size="md" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-(--color-border) bg-(--color-surface) px-3 py-2">
        {isOwnAsset ? (
          <span className="text-sm italic text-(--color-text-muted)">
            You can't rate your own skill.
          </span>
        ) : (
          <>
            <span className="text-sm text-(--color-text-muted)">How helpful was this skill?</span>
            <PromptRateStars
              value={myRating}
              disabled={rateMutation.isPending}
              size="md"
              onChange={(value) => {
                rateMutation.mutate(value);
                trackEvent("skill_rate", { skill_id: skillId, value });
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
              aria-label="Share skill link"
              onClick={() => void handleShare()}
            >
              <ShareIcon className="h-5 w-5" />
            </button>
            <AssetCollectionMenu assetId={skillId} assetTitle={skill.title} assetType="skill" />
            <button
              type="button"
              disabled={favoriteMutation.isPending}
              className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text) disabled:opacity-50"
              aria-label={favorited ? "Remove favorite" : "Add favorite"}
              onClick={() => {
                favoriteMutation.mutate();
                trackEvent("skill_favorite_toggle", { skill_id: skillId, source: "detail" });
              }}
            >
              <HeartIcon className="h-5 w-5" filled={favorited} />
            </button>
          </>
        }
        primary={
          <a
            href={skill.skillUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleDownloadSkill}
            className="inline-flex items-center gap-2 rounded-xl border border-(--color-primary) bg-(--color-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-(--color-primary-hover)"
          >
            <ExternalLinkIcon className="h-4 w-4 shrink-0" />
            Get the Skill
          </a>
        }
        secondary={
          distinctHelpUrl ? (
            <a
              href={distinctHelpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-(--color-border) bg-(--color-surface) px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors hover:bg-(--color-surface-muted)"
            >
              <DocumentIcon className="h-4 w-4" />
              View Documentation
            </a>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors bg-[#5A1BA9] text-white hover:bg-[#4A1589]"
              onClick={() => void handleCopyPageLink()}
            >
              <CopyIcon className="h-4 w-4" />
              Copy link
            </button>
          )
        }
      />

      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        title="Delete Skill"
        assetType="skill"
        assetName={skill.title}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDeleteModal(false)}
      />
    </article>
  );
}
