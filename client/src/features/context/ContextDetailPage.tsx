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
import {
  archiveContextDocument,
  deleteContextDocumentPermanently,
  getContextDocument,
  logContextUsage,
  toggleContextFavorite,
} from "./api";
import { CopyIcon, DownloadIcon, EyeIcon, HeartIcon, ShareIcon } from "../prompts/promptActionIcons";

type ViewMode = "preview" | "raw";

export function ContextDetailPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [favorited, setFavorited] = useState(false);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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

  const deleteMutation = useMutation({
    mutationFn: () => deleteContextDocumentPermanently(docId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["context"] });
      trackEvent("context_delete", { context_id: docId });
      void navigate("/context");
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: () => toggleContextFavorite(docId),
    onSuccess: async (data) => {
      setFavorited(data.favorited);
      await queryClient.invalidateQueries({ queryKey: ["context", docId] });
      await queryClient.invalidateQueries({ queryKey: ["context"] });
    },
  });

  useEffect(() => {
    if (docQuery.data) {
      setFavorited(docQuery.data.favorited ?? false);
      const next: Record<string, string> = {};
      for (const variable of docQuery.data.variables ?? []) {
        next[variable.key] = variable.defaultValue ?? "";
      }
      setVariableValues(next);
    }
  }, [docQuery.data?.id, docQuery.data?.favorited]);

  useEffect(() => {
    if (Number.isInteger(docId) && docId > 0) {
      void logContextUsage(docId, "VIEW");
      trackEvent("context_view", { context_id: docId });
    }
  }, [docId]);

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
  const canDelete = meQuery.data && meQuery.data.id === doc.owner.id;
  const viewCount = doc.viewCount ?? 0;
  const hasVariables = (doc.variables?.length ?? 0) > 0;

  const composed = useMemo(() => {
    if (!doc) {
      return { text: "", missingRequiredKeys: [] as string[] };
    }
    const variables = doc.variables ?? [];
    if (variables.length === 0) {
      return { text: doc.body, missingRequiredKeys: [] as string[] };
    }
    return interpolateBody(doc.body, variables, variableValues);
  }, [doc, variableValues]);

  const shareUrl = buildShareUrl(`/context/${docId}`);

  const handleShare = async () => {
    await shareOrCopyLink(doc.title, shareUrl);
    trackEvent("context_share", { context_id: docId, source: "detail" });
  };

  const handleCopyContent = async () => {
    const success = await copyToClipboard(composed.text);
    if (success) {
      trackEvent("context_copy", { context_id: docId, source: "detail" });
    }
  };

  const handleDownload = () => {
    const safeTitle = doc.title.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50);
    downloadAsMarkdown(composed.text, `${safeTitle}.md`);
    trackEvent("context_download", { context_id: docId, source: "detail" });
  };

  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Context</p>
          <h1 className="text-2xl font-semibold">{doc.title} <span className="text-(--color-text-muted)">[Context]</span></h1>
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
              className="rounded border border-amber-200 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/40"
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
        {doc.status} · {doc.visibility} · Owner {doc.owner.name ?? `#${doc.owner.id}`} · Updated{" "}
        {new Date(doc.updatedAt).toLocaleString()}
      </p>
      <div className="flex items-center gap-1 text-sm text-(--color-text-muted)">
        <EyeIcon className="h-4 w-4" />
        <span>{viewCount.toLocaleString()} views</span>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-(--color-border) bg-(--color-surface) p-2">
        <button
          type="button"
          className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text)"
          aria-label="Copy context content"
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
          aria-label="Share context link"
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
            trackEvent("context_favorite_toggle", { context_id: docId, source: "detail" });
          }}
        >
          <HeartIcon className="h-5 w-5" filled={favorited} />
        </button>
      </div>

      {hasVariables ? (
        <section className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">Template</h3>
          <p className="text-xs text-(--color-text-muted)">
            This context uses variables. Fill them in below to see your customized version.
          </p>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded border border-(--color-border) bg-(--color-surface-muted) p-3 text-sm">
            {doc.body}
          </pre>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">Variables</h3>
          <VariableInputs
            variables={doc.variables ?? []}
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
              <MarkdownPreview content={doc.body} />
            </div>
          ) : (
            <pre className="mt-3 max-h-128 overflow-auto whitespace-pre-wrap font-mono text-sm">{doc.body}</pre>
          )}
        </section>
      )}

      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        title="Delete Context File"
        assetType="context"
        assetName={doc.title}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDeleteModal(false)}
      />
    </article>
  );
}
