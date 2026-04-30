import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DuplicateWarningModal,
  isDuplicateError,
  type DuplicateMatch,
} from "../../components/DuplicateWarningModal";
import { PublishStatusModal } from "../../components/PublishStatusModal";
import { VariableEditor, type VariableRow } from "../../components/VariableEditor";
import { sanitizeTitle } from "../../lib/sanitizeTitle";
import { SummaryField } from "../assets/SummaryField";
import { AssetTagsField } from "../tags/AssetTagsField";
import { ToolRequestModal } from "../prompts/ToolRequestModal";
import { PROMPT_MODALITY_OPTIONS, type PromptModality } from "../prompts/api";
import { createContextDocument, getContextToolsSortedAlphabetically, getContextToolLabel, type ContextTool } from "./api";

type PendingContextData = {
  title: string;
  summary?: string;
  body: string;
  visibility: "PUBLIC" | "TEAM" | "PRIVATE";
  tools: ContextTool[];
  modality: PromptModality;
  variables?: Array<{ key: string; label: string | null; defaultValue: string; required: boolean }>;
  tagIds: number[];
};

export function ContextEditorPage() {
  const navigate = useNavigate();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedTools, setSelectedTools] = useState<Set<ContextTool>>(new Set());
  const [otherToolName, setOtherToolName] = useState("");
  const [showToolRequestModal, setShowToolRequestModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<PendingContextData | null>(null);
  const [variableRows, setVariableRows] = useState<VariableRow[]>([]);
  const [bodyText, setBodyText] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

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

  const createMutation = useMutation({
    mutationFn: createContextDocument,
    onSuccess: (doc) => {
      navigate(`/context/${doc.id}`);
    },
    onError: (error) => {
      console.error("Create context error:", error);
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as { response?: { data?: unknown } };
        if (isDuplicateError(axiosError.response?.data)) {
          setDuplicateMatches(axiosError.response.data.error.duplicates);
          setShowDuplicateModal(true);
        }
      }
    },
  });

  const handlePublishChoice = (status: "DRAFT" | "PUBLISHED") => {
    if (!pendingFormData) return;
    setShowPublishModal(false);
    createMutation.mutate({
      ...pendingFormData,
      status,
    });
    setPendingFormData(null);
  };

  return (
    <form
      className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setValidationError(null);
        const formData = new FormData(event.currentTarget);
        const title = sanitizeTitle(String(formData.get("title") ?? ""));
        const summary = String(formData.get("summary") ?? "").trim();
        const body = bodyText.trim();
        const visibility = String(formData.get("visibility") ?? "PUBLIC") as "PUBLIC" | "TEAM" | "PRIVATE";
        const modality = String(formData.get("modality") ?? "").trim();
        const toolsArray = Array.from(selectedTools);
        if (!title) {
          setValidationError("Title is required.");
          return;
        }
        if (!body) {
          setValidationError("Body is required.");
          return;
        }
        if (toolsArray.length === 0) {
          setValidationError("Please select at least one tool.");
          return;
        }
        if (!PROMPT_MODALITY_OPTIONS.includes(modality as PromptModality)) {
          setValidationError("Please select a generated output type.");
          return;
        }
        if (selectedTools.has("other") && !otherToolName.trim()) {
          setValidationError("Please enter the tool name for 'Other'.");
          return;
        }
        if (selectedTagIds.length === 0) {
          setValidationError("Please select at least one tag.");
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
        
        setPendingFormData({
          title,
          summary: summary || undefined,
          body,
          visibility,
          tools: toolsArray,
          modality: modality as PromptModality,
          variables: variables.length > 0 ? variables : undefined,
          tagIds: selectedTagIds,
        });
        setShowPublishModal(true);
      }}
    >
      <h2 className="text-2xl font-semibold">Create context file</h2>
      <p className="text-sm text-(--color-text-muted)">Store rules, references, and guides as Markdown.</p>
      <input
        name="title"
        placeholder="Title"
        required
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <SummaryField assetType="context" />
      <div className="grid gap-2 md:grid-cols-2">
        <select
          name="visibility"
          defaultValue="PUBLIC"
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="PUBLIC">Public (All Users)</option>
          <option value="TEAM">Team (same Department/OU)</option>
          <option value="PRIVATE">Private (Only Me)</option>
        </select>
        <select
          name="modality"
          defaultValue=""
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="" disabled>
            Generated output (required)
          </option>
          {PROMPT_MODALITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
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

      <AssetTagsField canEdit required selectedIds={selectedTagIds} onChange={setSelectedTagIds} />

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
      {createMutation.isError ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-600" role="alert">
          {(() => {
            const err = createMutation.error;
            if (err && typeof err === "object" && "response" in err) {
              const axiosError = err as { response?: { data?: { error?: { message?: string; details?: Array<{ message: string; path?: (string | number)[] }> } } } };
              const serverError = axiosError.response?.data?.error;
              if (serverError?.details && serverError.details.length > 0) {
                return (
                  <div>
                    <p className="font-medium">{serverError.message}</p>
                    <ul className="mt-1 list-disc pl-5">
                      {serverError.details.map((detail, i) => (
                        <li key={i}>{detail.path?.join(".") ? `${detail.path.join(".")}: ` : ""}{detail.message}</li>
                      ))}
                    </ul>
                  </div>
                );
              }
              if (serverError?.message) return serverError.message;
            }
            return "Could not create document. Please try again.";
          })()}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={createMutation.isPending}
        className="rounded bg-(--color-primary) px-4 py-2 text-white hover:bg-(--color-primary-active) disabled:opacity-50"
      >
        {createMutation.isPending ? "Saving…" : "Create"}
      </button>
      <PublishStatusModal
        isOpen={showPublishModal}
        assetType="context"
        onConfirm={handlePublishChoice}
        onClose={() => {
          setShowPublishModal(false);
          setPendingFormData(null);
        }}
      />
      <DuplicateWarningModal
        isOpen={showDuplicateModal}
        assetType="context"
        duplicates={duplicateMatches}
        onClose={() => {
          setShowDuplicateModal(false);
          setDuplicateMatches([]);
        }}
      />
    </form>
  );
}
