import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createSkill } from "./api";

export function SkillEditorPage() {
  const navigate = useNavigate();
  const createMutation = useMutation({
    mutationFn: createSkill,
    onSuccess: (skill) => {
      navigate(`/skills/${skill.id}`);
    },
  });

  return (
    <form
      className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const title = String(formData.get("title") ?? "").trim();
        const summary = String(formData.get("summary") ?? "").trim();
        const body = String(formData.get("body") ?? "");
        const status = String(formData.get("status") ?? "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED";
        const visibility = String(formData.get("visibility") ?? "PUBLIC") as "PUBLIC" | "PRIVATE";
        if (!title || !body.trim()) {
          return;
        }
        createMutation.mutate({ title, summary: summary || undefined, body, status, visibility });
      }}
    >
      <h2 className="text-2xl font-semibold">Create skill</h2>
      <p className="text-sm text-(--color-text-muted)">Body supports Markdown.</p>
      <input
        name="title"
        placeholder="Title"
        required
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <input
        name="summary"
        placeholder="Summary (optional)"
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <div className="grid gap-2 md:grid-cols-2">
        <select
          name="status"
          defaultValue="DRAFT"
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          name="visibility"
          defaultValue="PUBLIC"
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="PUBLIC">Public</option>
          <option value="PRIVATE">Private</option>
        </select>
      </div>
      <textarea
        name="body"
        placeholder="Markdown body"
        required
        rows={16}
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 font-mono text-sm"
      />
      {createMutation.isError ? (
        <p className="text-sm text-red-600" role="alert">
          Could not create skill.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={createMutation.isPending}
        className="rounded bg-(--color-primary) px-4 py-2 text-white hover:bg-(--color-primary-active) disabled:opacity-50"
      >
        {createMutation.isPending ? "Saving…" : "Create"}
      </button>
    </form>
  );
}
