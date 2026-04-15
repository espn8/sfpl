import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchMe } from "../auth/api";
import { archiveSkill, getSkill } from "./api";

export function SkillDetailPage() {
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
      <section className="rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-4">
        <h2 className="text-sm font-semibold text-(--color-text-muted)">Body (Markdown)</h2>
        <pre className="mt-2 max-h-[32rem] overflow-auto whitespace-pre-wrap font-mono text-sm">{skill.body}</pre>
      </section>
    </article>
  );
}
