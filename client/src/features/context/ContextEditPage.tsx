import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { getContextDocument, updateContextDocument } from "./api";

export function ContextEditPage() {
  const params = useParams();
  const docId = Number(params.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const docQuery = useQuery({
    queryKey: ["context", docId],
    queryFn: () => getContextDocument(docId),
    enabled: Number.isInteger(docId) && docId > 0,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateContextDocument>[1]) => updateContextDocument(docId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["context", docId] });
      void queryClient.invalidateQueries({ queryKey: ["context"] });
      navigate(`/context/${docId}`);
    },
  });

  if (!Number.isInteger(docId) || docId <= 0) {
    return <p className="text-sm text-(--color-text-muted)">Invalid document.</p>;
  }

  if (docQuery.isLoading || !docQuery.data) {
    return <p className="text-sm text-(--color-text-muted)">Loading…</p>;
  }

  if (docQuery.isError) {
    return <p className="text-sm text-red-600">Could not load document.</p>;
  }

  const doc = docQuery.data;

  return (
    <form
      className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4"
      key={doc.updatedAt}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const title = String(formData.get("title") ?? "").trim();
        const summary = String(formData.get("summary") ?? "").trim();
        const body = String(formData.get("body") ?? "");
        const status = String(formData.get("status") ?? doc.status) as typeof doc.status;
        const visibility = String(formData.get("visibility") ?? doc.visibility) as typeof doc.visibility;
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
      <h2 className="text-2xl font-semibold">Edit context file</h2>
      <input
        name="title"
        defaultValue={doc.title}
        required
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <input
        name="summary"
        defaultValue={doc.summary ?? ""}
        placeholder="Summary (optional)"
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <div className="grid gap-2 md:grid-cols-2">
        <select
          name="status"
          defaultValue={doc.status}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          name="visibility"
          defaultValue={doc.visibility}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="PUBLIC">Public</option>
          <option value="PRIVATE">Private</option>
        </select>
      </div>
      <textarea
        name="body"
        defaultValue={doc.body}
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
