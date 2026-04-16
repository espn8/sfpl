import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { getSkill, updateSkill } from "./api";

export function SkillEditPage() {
  const params = useParams();
  const skillId = Number(params.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const skillQuery = useQuery({
    queryKey: ["skill", skillId],
    queryFn: () => getSkill(skillId),
    enabled: Number.isInteger(skillId) && skillId > 0,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateSkill>[1]) => updateSkill(skillId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["skill", skillId] });
      void queryClient.invalidateQueries({ queryKey: ["skills"] });
      navigate(`/skills/${skillId}`);
    },
  });

  if (!Number.isInteger(skillId) || skillId <= 0) {
    return <p className="text-sm text-(--color-text-muted)">Invalid skill.</p>;
  }

  if (skillQuery.isLoading || !skillQuery.data) {
    return <p className="text-sm text-(--color-text-muted)">Loading…</p>;
  }

  if (skillQuery.isError) {
    return <p className="text-sm text-red-600">Could not load skill.</p>;
  }

  const skill = skillQuery.data;

  return (
    <form
      className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4"
      key={skill.updatedAt}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const title = String(formData.get("title") ?? "").trim();
        const summary = String(formData.get("summary") ?? "").trim();
        const body = String(formData.get("body") ?? "");
        const status = String(formData.get("status") ?? skill.status) as typeof skill.status;
        const visibility = String(formData.get("visibility") ?? skill.visibility) as typeof skill.visibility;
        if (!title || !body.trim()) {
          return;
        }
        updateMutation.mutate({
          title,
          summary: summary || undefined,
          body,
          status,
          visibility,
        });
      }}
    >
      <h2 className="text-2xl font-semibold">Edit skill</h2>
      <input
        name="title"
        defaultValue={skill.title}
        required
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <input
        name="summary"
        defaultValue={skill.summary ?? ""}
        placeholder="Summary (optional)"
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <div className="grid gap-2 md:grid-cols-2">
        <select
          name="status"
          defaultValue={skill.status}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          name="visibility"
          defaultValue={skill.visibility}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="PUBLIC">Public (All Users)</option>
          <option value="TEAM">Team (My OU Only)</option>
          <option value="PRIVATE">Private (Only Me)</option>
        </select>
      </div>
      <textarea
        name="body"
        defaultValue={skill.body}
        required
        rows={16}
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 font-mono text-sm"
      />
      {updateMutation.isError ? (
        <p className="text-sm text-red-600" role="alert">
          Could not save changes.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={updateMutation.isPending}
        className="rounded bg-(--color-primary) px-4 py-2 text-white hover:bg-(--color-primary-active) disabled:opacity-50"
      >
        {updateMutation.isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
