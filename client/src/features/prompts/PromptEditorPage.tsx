import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import {
  createPrompt,
  getToolLabel,
  getToolsSortedAlphabetically,
  PROMPT_MODALITY_OPTIONS,
  TOOL_REQUEST_URL,
  type PromptModality,
  type PromptTool,
} from "./api";

type VariableRow = {
  clientId: string;
  key: string;
  label: string;
  defaultValue: string;
  required: boolean;
};

export function PromptEditorPage() {
  const navigate = useNavigate();
  const [variableRows, setVariableRows] = useState<VariableRow[]>([]);
  const [selectedTools, setSelectedTools] = useState<Set<PromptTool>>(new Set());
  const [otherToolName, setOtherToolName] = useState("");
  const createMutation = useMutation({
    mutationFn: createPrompt,
    onSuccess: (prompt) => {
      trackEvent("prompt_create", { prompt_id: prompt.id });
      navigate(`/prompts/${prompt.id}`);
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
        const body = String(formData.get("body") ?? "").trim();
        const status = String(formData.get("status") ?? "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED";
        const visibility = String(formData.get("visibility") ?? "PUBLIC") as "PUBLIC" | "PRIVATE";
        const toolsArray = Array.from(selectedTools);
        const modality = String(formData.get("modality") ?? "").trim();
        if (!title || !body || toolsArray.length === 0 || !PROMPT_MODALITY_OPTIONS.includes(modality as PromptModality)) {
          return;
        }
        if (selectedTools.has("other") && !otherToolName.trim()) {
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
        createMutation.mutate({
          title,
          summary,
          body,
          status,
          visibility,
          tools: toolsArray,
          modality: modality as PromptModality,
          modelHint: selectedTools.has("other") && otherToolName.trim() ? otherToolName.trim() : undefined,
          variables: variables.length > 0 ? variables : undefined,
        });
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
      <div>
        <input
          name="summary"
          placeholder="Summary"
          className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        />
        <p className="mt-1 text-xs text-(--color-text-muted)">Why would someone use this prompt?</p>
      </div>
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
      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-2 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
          <p className="text-sm font-medium">Tools (select one or many)</p>
          <div className="grid gap-2 sm:grid-cols-2">
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
                <a
                  href={TOOL_REQUEST_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-(--color-primary) underline hover:text-(--color-primary-hover)"
                >
                  Request a new tool be added
                </a>
              </p>
            </div>
          )}
        </div>
        <select
          name="modality"
          defaultValue=""
          className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
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
      <textarea
        name="body"
        placeholder="Write your prompt here. Use [VARIABLE] or {{VARIABLE}} for customizable fields."
        className="h-48 w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <section className="space-y-3 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Template variables (optional)</p>
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
                  Key
                  <input
                    className="rounded border border-(--color-border) bg-(--color-surface-muted) px-2 py-1"
                    value={row.key}
                    onChange={(event) => {
                      const value = event.target.value;
                      setVariableRows((current) =>
                        current.map((item, itemIndex) => (itemIndex === index ? { ...item, key: value } : item)),
                      );
                    }}
                    placeholder="e.g. TOPIC"
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
                <button
                  type="button"
                  className="text-xs text-(--color-danger) underline md:col-span-2"
                  onClick={() => {
                    setVariableRows((current) => current.filter((_, itemIndex) => itemIndex !== index));
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <button
        type="submit"
        className="rounded bg-(--color-primary) px-4 py-2 text-(--color-text-inverse) hover:bg-(--color-primary-active) active:bg-(--color-primary-active)"
      >
        Save Prompt
      </button>
    </form>
  );
}
