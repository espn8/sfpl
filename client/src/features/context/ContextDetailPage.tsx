import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { useToast } from "../../app/providers/ToastProvider";
import { AssetDetailActionBar } from "../../components/AssetDetailActionBar";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { MarkdownPreview } from "../../components/MarkdownPreview";
import { VariableInputs } from "../../components/VariableInputs";
import { interpolateBody } from "../../lib/interpolate";
import { buildShareUrl, copyToClipboard, downloadAsMarkdown, shareOrCopyLink } from "../../lib/shareOrCopyLink";
import { fetchMe } from "../auth/api";
import { canCreateContent, canPermanentlyDeleteAsset } from "../auth/roles";
import {
  archiveContextDocument,
  deleteContextDocumentPermanently,
  getContextDocument,
  getContextToolLabel,
  logContextUsage,
  rateContext,
  regenerateContextThumbnail,
  toggleContextFavorite,
} from "./api";
import { CopyIcon, DownloadIcon, HeartIcon, ShareIcon } from "../prompts/promptActionIcons";
import { modalityLabel } from "../prompts/promptTagChips";
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

type ViewMode = "preview" | "raw";

export function ContextDetailPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [favorited, setFavorited] = useState(false);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { showToast } = useToast();
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["context"] });
      trackEvent("context_delete", { context_id: docId });
      navigate("/context");
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

  const regenerateThumbnailMutation = useMutation({
    mutationFn: () => regenerateContextThumbnail(docId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["context", docId] });
      await queryClient.invalidateQueries({ queryKey: ["context"] });
    },
  });

  const rateMutation = useMutation({
    mutationFn: (value: number) => rateContext(docId, value),
    onSuccess: async (_, value) => {
      setMyRating(value);
      await queryClient.invalidateQueries({ queryKey: ["context", docId] });
      await queryClient.invalidateQueries({ queryKey: ["context"] });
    },
  });

  useEffect(() => {
    if (docQuery.data) {
      setFavorited(docQuery.data.favorited ?? false);
      setMyRating(docQuery.data.myRating ?? null);
      const next: Record<string, string> = {};
      for (const variable of docQuery.data.variables ?? []) {
        next[variable.key] = variable.defaultValue ?? "";
      }
      setVariableValues(next);
    }
  }, [docQuery.data?.id, docQuery.data?.favorited, docQuery.data?.myRating]);

  useEffect(() => {
    if (Number.isInteger(docId) && docId > 0) {
      void logContextUsage(docId, "VIEW");
      trackEvent("context_view", { context_id: docId });
    }
  }, [docId]);

  const doc = docQuery.data;

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

  if (!Number.isInteger(docId) || docId <= 0) {
    return <p className="text-sm text-(--color-text-muted)">Invalid document.</p>;
  }

  if (docQuery.isLoading) {
    return <p className="text-sm text-(--color-text-muted)">Loading…</p>;
  }

  if (docQuery.isError || !doc) {
    return <p className="text-sm text-red-600">Document not found or inaccessible.</p>;
  }

  const me = meQuery.data;
  const canEdit =
    me &&
    canCreateContent(me.role) &&
    (me.id === doc.owner.id || me.role === "ADMIN" || me.role === "OWNER");
  const canDelete = me != null && canPermanentlyDeleteAsset(me.role, me.id, doc.owner.id);
  const isOwnAsset = Boolean(me && me.id === doc.owner.id);
  const averageRating = doc.averageRating ?? null;
  const hasVariables = (doc.variables?.length ?? 0) > 0;

  const shareUrl = buildShareUrl(`/context/${docId}`);

  const handleShare = async () => {
    await shareOrCopyLink(doc.title, shareUrl);
    trackEvent("context_share", { context_id: docId, source: "detail" });
  };

  const handleCopyContent = async () => {
    const success = await copyToClipboard(composed.text);
    if (success) {
      void logContextUsage(docId, "COPY");
      trackEvent("context_copy", { context_id: docId, source: "detail" });
      showToast("Copied to clipboard");
    }
  };

  const handleDownload = () => {
    const safeTitle = doc.title.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50);
    downloadAsMarkdown(composed.text, `${safeTitle}.md`);
    void logContextUsage(docId, "COPY");
    trackEvent("context_download", { context_id: docId, source: "detail" });
  };

  return (
    <article className="space-y-4">
      <VerificationBanner
        assetType="context"
        assetId={docId}
        status={doc.status}
        isOwner={isOwnAsset}
        lastVerifiedAt={doc.lastVerifiedAt}
        verificationDueAt={doc.verificationDueAt}
        archiveReason={doc.archiveReason}
      />
      <div className="flex gap-4">
        <PromptThumbnail
          title={doc.title}
          thumbnailUrl={doc.thumbnailUrl}
          thumbnailStatus={doc.thumbnailStatus}
          className="h-28 w-28 shrink-0 rounded object-cover"
          onRegenerate={canEdit ? () => regenerateThumbnailMutation.mutate() : undefined}
          isRegenerating={regenerateThumbnailMutation.isPending}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Context</p>
          <div className="flex items-start gap-2">
            <h1 className="text-2xl font-semibold">{doc.title} <span className="text-(--color-text-muted)">[Context]</span></h1>
            <AssetBadges
              createdAt={doc.createdAt}
              updatedAt={doc.updatedAt}
              isSmartPick={doc.isSmartPick}
              favoriteCount={doc.favoriteCount}
            />
          </div>
          {doc.summary ? <p className="mt-1 text-(--color-text-muted)">{doc.summary}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {doc.tools.map((tool) => (
              <span
                key={tool}
                className="rounded-full bg-(--color-text-inverse) px-2.5 py-0.5 text-xs font-medium text-(--color-bg)"
              >
                {getContextToolLabel(tool)}
              </span>
            ))}
            <span className="rounded-full bg-(--color-text-inverse) px-2.5 py-0.5 text-xs font-medium text-(--color-bg)">
              {modalityLabel(doc.modality)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div></div>
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
        {doc.status} · {doc.visibility} · Owner{" "}
        <Link to={`/users/${doc.owner.id}`} className="font-medium text-(--color-primary) underline-offset-2 hover:underline">
          {doc.owner.name ?? `#${doc.owner.id}`}
        </Link>{" "}
        · Updated {new Date(doc.updatedAt).toLocaleString()}
      </p>
      <div className="mt-2">
        <PromptAverageStars value={averageRating} size="md" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-(--color-border) bg-(--color-surface) px-3 py-2">
        {isOwnAsset ? (
          <span className="text-sm italic text-(--color-text-muted)">
            You can't rate your own context document.
          </span>
        ) : (
          <>
            <span className="text-sm text-(--color-text-muted)">How helpful was this context?</span>
            <PromptRateStars
              value={myRating}
              disabled={rateMutation.isPending}
              size="md"
              onChange={(value) => {
                rateMutation.mutate(value);
                trackEvent("context_rate", { context_id: docId, value });
              }}
            />
          </>
        )}
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

      <AssetDetailActionBar
        left={
          <>
            <button
              type="button"
              className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text)"
              aria-label="Share context link"
              onClick={() => void handleShare()}
            >
              <ShareIcon className="h-5 w-5" />
            </button>
            <AssetCollectionMenu assetId={docId} assetTitle={doc.title} assetType="context" />
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
            {doc.supportUrl ? (
              <a
                href={doc.supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text)"
                aria-label="View documentation"
              >
                <DocumentIcon className="h-5 w-5" />
              </a>
            ) : null}
          </>
        }
        primary={
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors bg-(--color-launch) text-(--color-text-inverse) hover:bg-(--color-launch-hover)"
          >
            <DownloadIcon className="h-4 w-4" />
            Download
          </button>
        }
        secondary={
          <button
            type="button"
            onClick={() => void handleCopyContent()}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors bg-[#5A1BA9] text-white hover:bg-[#4A1589]"
          >
            <CopyIcon className="h-4 w-4" />
            Copy
          </button>
        }
      />

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
