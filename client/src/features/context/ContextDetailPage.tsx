import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchMe } from "../auth/api";
import { archiveContextDocument, getContextDocument } from "./api";

export function ContextDetailPage() {
  const params = useParams();
  const docId = Number(params.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const docQuery = useQuery({
    queryKey: ["context", docId],
    queryFn: () => getContextDocument(docId),
    enabled: Number.isInteger(docId) && docId > 0,
  });

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveContextDocument(docId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["context"] });
      void queryClient.invalidateQueries({ queryKey: ["context", docId] });
    },
  });

  if (!Number.isInteger(docId) || docId <= 0) {
    return <p className="text-sm text-(--color-text-muted)">Invalid document.</p>;
  }

  if (docQuery.isLoading) {
    return <p className="text-sm text-(--color-text-muted)">Loading…</p>;
  }

  if (docQuery.isError || !docQuery.data) {
    return <p className="text-sm text-red-600">Document not found or inaccessible.</p>;
  }

  const doc = docQuery.data;
  const canEdit =
    meQuery.data &&
    (meQuery.data.id === doc.owner.id || meQuery.data.role === "ADMIN" || meQuery.data.role === "OWNER");

  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Context</p>
          <h1 className="text-2xl font-semibold">{doc.title}</h1>
          {doc.summary ? <p className="mt-1 text-(--color-text-muted)">{doc.summary}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Link
              to={`/context/${doc.id}/edit`}
              className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-1.5 text-sm hover:bg-(--color-surface)"
            >
              Edit
            </Link>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
              disabled={archiveMutation.isPending || doc.status === "ARCHIVED"}
              onClick={() => {
                if (window.confirm("Archive this context file?")) {
                  archiveMutation.mutate(undefined, {
                    onSuccess: () => {
                      void navigate("/context");
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
        {doc.status} · {doc.visibility} · Owner {doc.owner.name ?? `#${doc.owner.id}`} · Updated{" "}
        {new Date(doc.updatedAt).toLocaleString()}
      </p>
      <section className="rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-4">
        <h2 className="text-sm font-semibold text-(--color-text-muted)">Body (Markdown)</h2>
        <pre className="mt-2 max-h-[32rem] overflow-auto whitespace-pre-wrap font-mono text-sm">{doc.body}</pre>
      </section>
    </article>
  );
}
