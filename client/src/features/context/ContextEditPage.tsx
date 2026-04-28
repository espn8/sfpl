import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { VariableEditor, type VariableRow } from "../../components/VariableEditor";
import { sanitizeTitle } from "../../lib/sanitizeTitle";
import { SummaryField } from "../assets/SummaryField";
import { fetchMe } from "../auth/api";
import { canPermanentlyDeleteAsset } from "../auth/roles";
import { AssetTagsField } from "../tags/AssetTagsField";
import { listTags } from "../tags/api";
import { ToolRequestModal } from "../prompts/ToolRequestModal";
import {
  deleteContextDocumentPermanently,
  getContextDocument,
  getContextToolsSortedAlphabetically,
  getContextToolLabel,
  replaceContextVariables,
  updateContextDocument,
} from "./api";

export function ContextEditPage() {
  const params = useParams();
  const docId = Number(params.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [otherToolName, setOtherToolName] = useState("");
  const [showToolRequestModal, setShowToolRequestModal] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [variableRows, setVariableRows] = useState<VariableRow[]>([]);
  const [bodyText, setBodyText] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const tagsCatalogQuery = useQuery({
    queryKey: ["tags", "picker"],
    queryFn: () => listTags({ limit: 500 }),
  });

  const insertVariable = (key: string) => {
    const textarea = bodyRef.current;
    if (!textarea) return;

    const placeholder = `[${key}]`;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const newText = bodyText.slice(0, start) + placeholder + bodyText.slice(end);
    setBodyText(newText);

    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + placeholder.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  const docQuery = useQuery({
    queryKey: ["context", docId],
    queryFn: () => getContextDocument(docId),
    enabled: Number.isInteger(docId) && docId > 0,
  });
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
  });

  useEffect(() => {
    if (docQuery.data) {
      setSelectedTools(new Set(docQuery.data.tools || []));
      setBodyText(docQuery.data.body);
      setVariableRows(
        (docQuery.data.variables ?? []).map((v) => ({
          clientId: `existing-${v.id}`,
          key: v.key,
          label: v.label ?? "",
          defaultValue: v.defaultValue ?? "",
          required: v.required,
        })),
      );
    }
  }, [docQuery.data?.id]);

  useEffect(() => {
    const d = docQuery.data;
    const catalog = tagsCatalogQuery.data;
    if (!d?.tags || !catalog) return;
    const nameSet = new Set(d.tags);
    setSelectedTagIds(catalog.filter((t) => nameSet.has(t.name)).map((t) => t.id));
  }, [docQuery.data?.id, docQuery.data?.tags, tagsCatalogQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateContextDocument>[1]) => updateContextDocument(docId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["context", docId] });
      void queryClient.invalidateQueries({ queryKey: ["context"] });
      navigate(`/context/${docId}`);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteContextDocumentPermanently(docId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["context"] });
      trackEvent("context_delete", { context_id: docId });
      navigate("/");
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
  const me = meQuery.data;
  const canDeleteAsset = me != null && canPermanentlyDeleteAsset(me.role, me.id, doc.owner.id);
  const isOwner = me != null && me.id === doc.owner.id;

  return (
    <form
      className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4"
      key={doc.updatedAt}
      onSubmit={async (event) => {
        event.preventDefault();
        setValidationError(null);
        const formData = new FormData(event.currentTarget);
        const title = sanitizeTitle(String(formData.get("title") ?? ""));
        const summary = String(formData.get("summary") ?? "").trim();
        const body = bodyText.trim();
        const status = String(formData.get("status") ?? doc.status) as typeof doc.status;
        const visibility = String(formData.get("visibility") ?? doc.visibility) as typeof doc.visibility;
        const toolsArray = Array.from(selectedTools);
        if (!title || !body) {
          setValidationError("Title and body are required.");
          return;
        }
        if (toolsArray.length === 0) {
          setValidationError("Please select at least one tool.");
          return;
        }
        if (selectedTools.has("other") && !otherToolName.trim()) {
          setValidationError("Please enter the tool name for 'Other'.");
          return;
        }
        const variables = variableRows
          .map((row) => ({
            key: row.key.trim(),
            label: row.label.trim() || null,
            defaultValue: row.defaultValue,
            required: row.required,
          }))
          .filter((row) => row.key.length > 0);
        await replaceContextVariables(docId, variables);
        updateMutation.mutate({
          title,
          summary: summary || undefined,
          body,
          status,
          visibility,
          tools: toolsArray,
          ...(isOwner ? { tagIds: selectedTagIds } : {}),
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
      <SummaryField
        assetType="context"
        defaultValue={doc.summary ?? ""}
        title={doc.title}
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
          <option value="PUBLIC">Public (All Users)</option>
          <option value="TEAM">Team (My OU Only)</option>
          <option value="PRIVATE">Private (Only Me)</option>
        </select>
      </div>
      <div className="space-y-2 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
        <p className="text-sm font-medium">Tools (select one or many)</p>
        <div className="grid gap-2 sm:grid-cols-4">
          {getContextToolsSortedAlphabetically().map((tool) => (
            <label key={tool} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedTools.has(tool)}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setSelectedTools((current) => {
                    const next = new Set(current);
                    if (checked) {
                      next.add(tool);
                    } else {
                      next.delete(tool);
                      if (tool === "other") {
                        setOtherToolName("");
                      }
                    }
                    return next;
                  });
                }}
              />
              <span>{getContextToolLabel(tool)}</span>
            </label>
          ))}
        </div>
        {selectedTools.has("other") && (
          <div className="space-y-2 border-t border-(--color-border) pt-3">
            <label className="block text-sm">
              <span className="font-medium">Tool name</span>
              <input
                type="text"
                value={otherToolName}
                onChange={(event) => setOtherToolName(event.target.value)}
                placeholder="Enter the tool name"
                className="mt-1 w-full rounded border border-(--color-border) bg-(--color-surface) px-3 py-2"
              />
            </label>
            <p className="text-xs text-(--color-text-muted)">
              Don't see your tool?{" "}
              <button
                type="button"
                onClick={() => setShowToolRequestModal(true)}
                className="font-medium text-(--color-primary) underline hover:text-(--color-primary-hover)"
              >
                Request a new tool be added
              </button>
            </p>
          </div>
        )}
        <ToolRequestModal isOpen={showToolRequestModal} onClose={() => setShowToolRequestModal(false)} />
      </div>

      <AssetTagsField
        canEdit={isOwner}
        selectedIds={selectedTagIds}
        onChange={setSelectedTagIds}
        readOnlyTagNames={doc.tags}
      />

      <textarea
        ref={bodyRef}
        name="body"
        value={bodyText}
        onChange={(e) => setBodyText(e.target.value)}
        placeholder="Write your context content here. Use [VARIABLE] or {{VARIABLE}} for customizable fields."
        rows={16}
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 font-mono text-sm"
      />
      <VariableEditor variables={variableRows} onChange={setVariableRows} onInsert={insertVariable} />
      {validationError ? (
        <p className="text-sm text-red-600" role="alert">
          {validationError}
        </p>
      ) : null}
      {updateMutation.isError ? (
        <p className="text-sm text-red-600" role="alert">
          Could not save changes.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="rounded bg-(--color-primary) px-4 py-2 text-white hover:bg-(--color-primary-active) disabled:opacity-50"
        >
          {updateMutation.isPending ? "Saving…" : "Save"}
        </button>
        {canDeleteAsset ? (
          <button
            type="button"
            className="rounded border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            disabled={deleteMutation.isPending || updateMutation.isPending}
            onClick={() => setShowDeleteModal(true)}
          >
            Delete
          </button>
        ) : null}
      </div>
      {deleteMutation.isError ? (
        <p className="text-sm text-red-600" role="alert">
          Could not delete this context file. Please try again.
        </p>
      ) : null}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        title="Delete context file"
        assetType="context"
        assetName={doc.title}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDeleteModal(false)}
      />
    </form>
  );
}
