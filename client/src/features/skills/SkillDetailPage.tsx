import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { MarkdownPreview } from "../../components/MarkdownPreview";
import { VariableInputs } from "../../components/VariableInputs";
import { interpolateBody } from "../../lib/interpolate";
import { buildShareUrl, copyToClipboard, downloadAsMarkdown, shareOrCopyLink } from "../../lib/shareOrCopyLink";
import { fetchMe } from "../auth/api";
import { canCreateContent } from "../auth/roles";
import { archiveSkill, deleteSkillPermanently, getSkill, logSkillUsage, rateSkill, regenerateSkillThumbnail, toggleSkillFavorite, getSkillToolLabel } from "./api";
import { CopyIcon, DownloadIcon, HeartIcon, ShareIcon } from "../prompts/promptActionIcons";
import { PromptThumbnail } from "../prompts/PromptThumbnail";
import { PromptAverageStars, PromptRateStars } from "../prompts/PromptStars";
import { AssetCollectionMenu } from "../../components/AssetCollectionMenu";
import { AssetBadges } from "../assets/badges";

type ViewMode = "preview" | "raw";

export function SkillDetailPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [favorited, setFavorited] = useState(false);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
      const next: Record<string, string> = {};
      for (const variable of skillQuery.data.variables ?? []) {
        next[variable.key] = variable.defaultValue ?? "";
      }
      setVariableValues(next);
    }
  }, [skillQuery.data?.id, skillQuery.data?.favorited, skillQuery.data?.myRating]);

  useEffect(() => {
    if (Number.isInteger(skillId) && skillId > 0) {
      void logSkillUsage(skillId, "VIEW");
      trackEvent("skill_view", { skill_id: skillId });
    }
  }, [skillId]);

  const skill = skillQuery.data;

  const composed = useMemo(() => {
    if (!skill) {
      return { text: "", missingRequiredKeys: [] as string[] };
    }
    const variables = skill.variables ?? [];
    if (variables.length === 0) {
      return { text: skill.body, missingRequiredKeys: [] as string[] };
    }
    return interpolateBody(skill.body, variables, variableValues);
  }, [skill, variableValues]);

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
  const viewCount = skill.viewCount ?? 0;
  const copyCount = skill.copyCount ?? 0;
  const favoriteCount = skill.favoriteCount ?? 0;
  const ratingCount = skill.ratingCount ?? 0;
  const averageRating = skill.averageRating ?? null;
  const hasVariables = (skill.variables?.length ?? 0) > 0;

  const shareUrl = buildShareUrl(`/skills/${skillId}`);

  const handleShare = async () => {
    await shareOrCopyLink(skill.title, shareUrl);
    trackEvent("skill_share", { skill_id: skillId, source: "detail" });
  };

  const handleCopyContent = async () => {
    const success = await copyToClipboard(composed.text);
    if (success) {
      trackEvent("skill_copy", { skill_id: skillId, source: "detail" });
    }
  };

  const handleDownload = () => {
    const safeTitle = skill.title.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50);
    downloadAsMarkdown(composed.text, `${safeTitle}.md`);
    trackEvent("skill_download", { skill_id: skillId, source: "detail" });
  };

  return (
    <article className="space-y-4">
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
      <div className="grid gap-2 text-sm md:grid-cols-4">
        <p className="rounded border border-(--color-border) px-3 py-2">
          <span className="font-semibold">Views:</span> {viewCount.toLocaleString()}
        </p>
        <p className="rounded border border-(--color-border) px-3 py-2">
          <span className="font-semibold">Copies:</span> {copyCount.toLocaleString()}
        </p>
        <p className="rounded border border-(--color-border) px-3 py-2">
          <span className="font-semibold">Favorites:</span> {favoriteCount.toLocaleString()}
        </p>
        <p className="rounded border border-(--color-border) px-3 py-2">
          <span className="font-semibold">Ratings:</span> {ratingCount.toLocaleString()}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-(--color-border) bg-(--color-surface) px-3 py-2">
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
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-(--color-border) bg-(--color-surface) p-2">
        <button
          type="button"
          className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text)"
          aria-label="Copy skill content"
          onClick={() => void handleCopyContent()}
        >
          <CopyIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text)"
          aria-label="Download as .md file"
          onClick={handleDownload}
        >
          <DownloadIcon className="h-5 w-5" />
        </button>
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
      </div>

      {hasVariables ? (
        <section className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">Template</h3>
          <p className="text-xs text-(--color-text-muted)">
            This skill uses variables. Fill them in below to see your customized version.
          </p>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded border border-(--color-border) bg-(--color-surface-muted) p-3 text-sm">
            {skill.body}
          </pre>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">Variables</h3>
          <VariableInputs
            variables={skill.variables ?? []}
            values={variableValues}
            onChange={setVariableValues}
          />
          {composed.missingRequiredKeys.length > 0 ? (
            <p className="text-sm text-(--color-danger)">
              Fill required variables: {composed.missingRequiredKeys.join(", ")}
            </p>
          ) : null}
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">Preview</h3>
            <div className="flex items-center justify-between gap-2">
              <div className="flex rounded-md border border-(--color-border) bg-(--color-surface) p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("preview")}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                    viewMode === "preview"
                      ? "bg-(--color-primary) text-(--color-text-inverse)"
                      : "text-(--color-text-muted) hover:text-(--color-text)"
                  }`}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("raw")}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                    viewMode === "raw"
                      ? "bg-(--color-primary) text-(--color-text-inverse)"
                      : "text-(--color-text-muted) hover:text-(--color-text)"
                  }`}
                >
                  Raw
                </button>
              </div>
            </div>
            {viewMode === "preview" ? (
              <div className="mt-3 max-h-128 overflow-auto">
                <MarkdownPreview content={composed.text} />
              </div>
            ) : (
              <pre className="mt-3 max-h-128 overflow-auto whitespace-pre-wrap rounded border border-(--color-border) bg-(--color-surface-muted) p-3 font-mono text-sm">
                {composed.text}
              </pre>
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-(--color-text-muted)">Body (Markdown)</h2>
            <div className="flex rounded-md border border-(--color-border) bg-(--color-surface) p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  viewMode === "preview"
                    ? "bg-(--color-primary) text-(--color-text-inverse)"
                    : "text-(--color-text-muted) hover:text-(--color-text)"
                }`}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setViewMode("raw")}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  viewMode === "raw"
                    ? "bg-(--color-primary) text-(--color-text-inverse)"
                    : "text-(--color-text-muted) hover:text-(--color-text)"
                }`}
              >
                Raw
              </button>
            </div>
          </div>
          {viewMode === "preview" ? (
            <div className="mt-3 max-h-128 overflow-auto">
              <MarkdownPreview content={skill.body} />
            </div>
          ) : (
            <pre className="mt-3 max-h-128 overflow-auto whitespace-pre-wrap font-mono text-sm">{skill.body}</pre>
          )}
        </section>
      )}

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
