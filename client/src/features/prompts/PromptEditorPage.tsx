import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { PublishStatusModal } from "../../components/PublishStatusModal";
import {
  DuplicateWarningModal,
  isDuplicateError,
  type DuplicateMatch,
} from "../../components/DuplicateWarningModal";
import { sanitizeTitle } from "../../lib/sanitizeTitle";
import { SummaryField } from "../assets/SummaryField";
import { AssetTagsField } from "../tags/AssetTagsField";
import {
  createPrompt,
  getToolLabel,
  getToolsSortedAlphabetically,
  PROMPT_MODALITY_OPTIONS,
  type PromptModality,
  type PromptTool,
} from "./api";
import { ToolRequestModal } from "./ToolRequestModal";

type VariableRow = {
  clientId: string;
  key: string;
  label: string;
  defaultValue: string;
  required: boolean;
};

type PendingPromptData = {
  title: string;
  summary: string;
  body: string;
  visibility: "PUBLIC" | "TEAM" | "PRIVATE";
  tools: PromptTool[];
  modality: PromptModality;
  modelHint?: string;
  variables?: Array<{ key: string; label: string | null; defaultValue: string; required: boolean }>;
  tagIds: number[];
};

function sanitizeVariableKey(input: string): string {
  let result = input.replace(/[^A-Za-z0-9_]/g, "_");
  if (result.length > 0 && /^[0-9]/.test(result)) {
    result = "_" + result;
  }
  return result.toUpperCase();
}

export function PromptEditorPage() {
  const navigate = useNavigate();
  const [variableRows, setVariableRows] = useState<VariableRow[]>([]);
  const [selectedTools, setSelectedTools] = useState<Set<PromptTool>>(new Set());
  const [otherToolName, setOtherToolName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showToolRequestModal, setShowToolRequestModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<PendingPromptData | null>(null);
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
    mutationFn: createPrompt,
    onSuccess: (prompt) => {
      trackEvent("prompt_create", { prompt_id: prompt.id });
      navigate(`/prompts/${prompt.id}`);
    },
    onError: (error) => {
      console.error("Create prompt error:", error);
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
        const toolsArray = Array.from(selectedTools);
        const modality = String(formData.get("modality") ?? "").trim();
        if (!title) {
          setValidationError("Title is required.");
          return;
        }
        if (!body) {
          setValidationError("Prompt body is required.");
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
          summary,
          body,
          visibility,
          tools: toolsArray,
          modality: modality as PromptModality,
          modelHint: selectedTools.has("other") && otherToolName.trim() ? otherToolName.trim() : undefined,
          variables: variables.length > 0 ? variables : undefined,
          tagIds: selectedTagIds,
        });
        setShowPublishModal(true);
      }}
    >
      <h2 className="text-2xl font-semibold">Create a New Prompt</h2>
      <div>
        <input
          name="title"
          placeholder="Title"
          className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        />
        <p className="mt-1 text-xs text-(--color-text-muted)">A short name for your prompt</p>
      </div>
      <SummaryField assetType="prompt" />
      <AssetTagsField canEdit required selectedIds={selectedTagIds} onChange={setSelectedTagIds} />

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
          {getToolsSortedAlphabetically().map((tool) => (
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
              <span>{getToolLabel(tool)}</span>
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
      <textarea
        ref={bodyRef}
        name="body"
        value={bodyText}
        onChange={(e) => setBodyText(e.target.value)}
        placeholder="Write your prompt here. Use [VARIABLE] or {{VARIABLE}} for customizable fields."
        className="h-48 w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <section className="space-y-3 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Template variables (optional)</p>
            <p className="text-xs text-(--color-text-muted)">
              Define placeholders for dynamic content. Add a variable below and click{" "}
              <strong>Insert</strong> to add it to your prompt body, or manually type{" "}
              <code className="rounded bg-(--color-surface) px-1">[KEY]</code> or{" "}
              <code className="rounded bg-(--color-surface) px-1">{"{{KEY}}"}</code>.
            </p>
          </div>
          <button
            type="button"
            className="rounded border border-(--color-border) bg-(--color-surface) px-2 py-1 text-xs"
            onClick={() => {
              setVariableRows((current) => [
                ...current,
                {
                  clientId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                  key: "",
                  label: "",
                  defaultValue: "",
                  required: false,
                },
              ]);
            }}
          >
            Add variable
          </button>
        </div>
        {variableRows.length > 0 ? (
          <ul className="space-y-3">
            {variableRows.map((row, index) => (
              <li
                key={row.clientId}
                className="grid gap-2 rounded border border-(--color-border) bg-(--color-surface) p-3 md:grid-cols-2"
              >
                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="flex items-center gap-2">
                    Key
                    <span className="text-xs font-normal text-(--color-text-muted)">(letters, numbers, underscores only)</span>
                  </span>
                  <input
                    className="rounded border border-(--color-border) bg-(--color-surface-muted) px-2 py-1 font-mono uppercase"
                    value={row.key}
                    onChange={(event) => {
                      const value = sanitizeVariableKey(event.target.value);
                      setVariableRows((current) =>
                        current.map((item, itemIndex) => (itemIndex === index ? { ...item, key: value } : item)),
                      );
                    }}
                    placeholder="e.g. TOPIC"
                    maxLength={64}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Label
                  <input
                    className="rounded border border-(--color-border) bg-(--color-surface-muted) px-2 py-1"
                    value={row.label}
                    onChange={(event) => {
                      const value = event.target.value;
                      setVariableRows((current) =>
                        current.map((item, itemIndex) => (itemIndex === index ? { ...item, label: value } : item)),
                      );
                    }}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Default
                  <input
                    className="rounded border border-(--color-border) bg-(--color-surface-muted) px-2 py-1"
                    value={row.defaultValue}
                    onChange={(event) => {
                      const value = event.target.value;
                      setVariableRows((current) =>
                        current.map((item, itemIndex) => (itemIndex === index ? { ...item, defaultValue: value } : item)),
                      );
                    }}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    checked={row.required}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setVariableRows((current) =>
                        current.map((item, itemIndex) => (itemIndex === index ? { ...item, required: checked } : item)),
                      );
                    }}
                  />
                  Required
                </label>
                <div className="flex items-center gap-3 md:col-span-2">
                  {row.key.trim() && (
                    <button
                      type="button"
                      className="rounded bg-(--color-primary) px-2 py-1 text-xs text-(--color-text-inverse) hover:bg-(--color-primary-hover)"
                      onClick={() => insertVariable(row.key.trim())}
                    >
                      Insert [{row.key.trim()}]
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-xs text-(--color-danger) underline"
                    onClick={() => {
                      setVariableRows((current) => current.filter((_, itemIndex) => itemIndex !== index));
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      {validationError ? (
        <p className="rounded border border-(--color-danger) bg-(--color-danger)/10 px-3 py-2 text-sm text-(--color-danger)" role="alert">
          {validationError}
        </p>
      ) : null}
      {createMutation.isError ? (
        <div className="rounded border border-(--color-danger) bg-(--color-danger)/10 px-3 py-2 text-sm text-(--color-danger)" role="alert">
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
            return "Could not create prompt. Please try again.";
          })()}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={createMutation.isPending}
        className="rounded bg-(--color-primary) px-4 py-2 text-(--color-text-inverse) hover:bg-(--color-primary-hover) active:bg-(--color-primary-active) disabled:cursor-not-allowed disabled:opacity-50"
      >
        {createMutation.isPending ? "Saving..." : "Save Prompt"}
      </button>
      <PublishStatusModal
        isOpen={showPublishModal}
        assetType="prompt"
        onConfirm={handlePublishChoice}
        onClose={() => {
          setShowPublishModal(false);
          setPendingFormData(null);
        }}
      />
      <DuplicateWarningModal
        isOpen={showDuplicateModal}
        assetType="prompt"
        duplicates={duplicateMatches}
        onClose={() => {
          setShowDuplicateModal(false);
          setDuplicateMatches([]);
        }}
      />
    </form>
  );
}
