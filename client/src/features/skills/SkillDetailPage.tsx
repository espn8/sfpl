import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { MarkdownPreview } from "../../components/MarkdownPreview";
import { buildShareUrl, copyToClipboard, shareOrCopyLink } from "../../lib/shareOrCopyLink";
import { fetchMe } from "../auth/api";
import { archiveSkill, getSkill, logSkillUsage, toggleSkillFavorite } from "./api";
import { CopyIcon, EyeIcon, HeartIcon, ShareIcon } from "../prompts/promptActionIcons";

type ViewMode = "preview" | "raw";

export function SkillDetailPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [favorited, setFavorited] = useState(false);
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

  const favoriteMutation = useMutation({
    mutationFn: () => toggleSkillFavorite(skillId),
    onSuccess: async (data) => {
      setFavorited(data.favorited);
      await queryClient.invalidateQueries({ queryKey: ["skill", skillId] });
      await queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });

  useEffect(() => {
    if (skillQuery.data) {
      setFavorited(skillQuery.data.favorited ?? false);
    }
  }, [skillQuery.data?.id, skillQuery.data?.favorited]);

  useEffect(() => {
    if (Number.isInteger(skillId) && skillId > 0) {
      void logSkillUsage(skillId, "VIEW");
      trackEvent("skill_view", { skill_id: skillId });
    }
  }, [skillId]);

  if (!Number.isInteger(skillId) || skillId <= 0) {
    return <p className="text-sm text-(--color-text-muted)">Invalid skill.</p>;
  }

  if (skillQuery.isLoading) {
    return <p className="text-sm text-(--color-text-muted)">Loading…</p>;
  }

  if (skillQuery.isError || !skillQuery.data) {
    return <p className="text-sm text-red-600">Skill not found or inaccessible.</p>;
  }

  const skill = skillQuery.data;
  const canEdit =
    meQuery.data &&
    (meQuery.data.id === skill.owner.id || meQuery.data.role === "ADMIN" || meQuery.data.role === "OWNER");
  const viewCount = skill.viewCount ?? 0;

  const shareUrl = buildShareUrl(`/skills/${skillId}`);

  const handleShare = async () => {
    await shareOrCopyLink(skill.title, shareUrl);
    trackEvent("skill_share", { skill_id: skillId, source: "detail" });
  };

  const handleCopyContent = async () => {
    const success = await copyToClipboard(skill.body);
    if (success) {
      trackEvent("skill_copy", { skill_id: skillId, source: "detail" });
    }
  };

  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Skill</p>
          <h1 className="text-2xl font-semibold">{skill.title}</h1>
          {skill.summary ? <p className="mt-1 text-(--color-text-muted)">{skill.summary}</p> : null}
        </div>
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
              className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
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
        </div>
      </div>
      <p className="text-sm text-(--color-text-muted)">
        {skill.status} · {skill.visibility} · Owner {skill.owner.name ?? `#${skill.owner.id}`} · Updated{" "}
        {new Date(skill.updatedAt).toLocaleString()}
      </p>
      <div className="flex items-center gap-1 text-sm text-(--color-text-muted)">
        <EyeIcon className="h-4 w-4" />
        <span>{viewCount.toLocaleString()} views</span>
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
          aria-label="Share skill link"
          onClick={() => void handleShare()}
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
            trackEvent("skill_favorite_toggle", { skill_id: skillId, source: "detail" });
          }}
        >
          <HeartIcon className="h-5 w-5" filled={favorited} />
        </button>
      </div>

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
    </article>
  );
}
