import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { sanitizeTitle } from "../../lib/sanitizeTitle";
import { listTags } from "../tags/api";
import {
  getPrompt,
  getToolLabel,
  getToolsSortedAlphabetically,
  PROMPT_MODALITY_OPTIONS,
  type PromptModality,
  type PromptTool,
  type PromptVariable,
  regeneratePromptThumbnail,
  replacePromptVariables,
  updatePrompt,
} from "./api";
import { PromptThumbnail } from "./PromptThumbnail";
import { ToolRequestModal } from "./ToolRequestModal";

type VariableRow = {
  clientId: string;
  key: string;
  label: string;
  defaultValue: string;
  required: boolean;
};

function rowsFromApi(variables: PromptVariable[]): VariableRow[] {
  return variables.map((variable, index) => ({
    clientId: `existing-${variable.id}-${index}`,
    key: variable.key,
    label: variable.label ?? "",
    defaultValue: variable.defaultValue ?? "",
    required: variable.required,
  }));
}

export function PromptEditPage() {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const promptId = Number(params.id);
  const [variableRows, setVariableRows] = useState<VariableRow[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedTools, setSelectedTools] = useState<Set<PromptTool>>(new Set());
  const [otherToolName, setOtherToolName] = useState("");
  const [showToolRequestModal, setShowToolRequestModal] = useState(false);

  const promptQuery = useQuery({
    queryKey: ["prompt", promptId],
    queryFn: () => getPrompt(promptId),
    enabled: Number.isInteger(promptId) && promptId > 0,
  });

  const tagsQuery = useQuery({
    queryKey: ["tags"],
    queryFn: listTags,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      summary: string;
      body: string;
      status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
      visibility: "PUBLIC" | "TEAM" | "PRIVATE";
      tools: PromptTool[];
      modality: PromptModality;
      modelHint: string | null;
      tagIds: number[];
      changelog?: string;
    }) => {
      await updatePrompt(promptId, payload);
      const variables = variableRows
        .map((row) => ({
          key: row.key.trim(),
          label: row.label.trim() || null,
          defaultValue: row.defaultValue,
          required: row.required,
        }))
        .filter((row) => row.key.length > 0);
      await replacePromptVariables(promptId, { variables });
      return payload;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prompt", promptId] });
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
      navigate(`/prompts/${promptId}`);
    },
  });
  const regenerateMutation = useMutation({
    mutationFn: () => regeneratePromptThumbnail(promptId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prompt", promptId] });
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
  });

  useEffect(() => {
    const data = promptQuery.data;
    if (!data) {
      return;
    }
    setVariableRows(rowsFromApi(data.variables ?? []));
    setSelectedTagIds((data.promptTags ?? []).map((entry) => entry.tag.id));
    setSelectedTools(new Set(data.tools));
    if (data.tools.includes("other") && data.modelHint) {
      setOtherToolName(data.modelHint);
    }
  }, [promptQuery.data?.id]);

  if (promptQuery.isLoading) {
    return <p>Just a moment...</p>;
  }

  if (!promptQuery.data) {
    return <p className="text-red-700">This prompt doesn't exist or may have been removed.</p>;
  }

  const prompt = promptQuery.data;

  return (
    <form
      className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const title = sanitizeTitle(String(formData.get("title") ?? ""));
        const summary = String(formData.get("summary") ?? "").trim();
        const body = String(formData.get("body") ?? "").trim();
        const status = String(formData.get("status") ?? "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED";
        const visibility = String(formData.get("visibility") ?? "PUBLIC") as "PUBLIC" | "TEAM" | "PRIVATE";
        const toolsArray = Array.from(selectedTools);
        const modality = String(formData.get("modality") ?? "").trim();
        const changelog = String(formData.get("changelog") ?? "").trim();
        const modelHintRaw = String(formData.get("modelHint") ?? "").trim();
        let modelHint = modelHintRaw.length > 0 ? modelHintRaw : null;
        if (selectedTools.has("other") && otherToolName.trim()) {
          modelHint = otherToolName.trim();
        }
        if (!title || !body || toolsArray.length === 0 || !PROMPT_MODALITY_OPTIONS.includes(modality as PromptModality)) {
          return;
        }
        if (selectedTools.has("other") && !otherToolName.trim()) {
          return;
        }
        updateMutation.mutate({
          title,
          summary,
          body,
          status,
          visibility,
          tools: toolsArray,
          modality: modality as PromptModality,
          modelHint,
          tagIds: selectedTagIds,
          changelog: changelog.length > 0 ? changelog : undefined,
        });
      }}
    >
      <h2 className="text-2xl font-semibold">Edit Prompt</h2>
      <div className="flex items-center gap-3 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
        <PromptThumbnail
          title={prompt.title}
          thumbnailUrl={prompt.thumbnailUrl}
          thumbnailStatus={prompt.thumbnailStatus}
          className="h-20 w-20 rounded object-cover"
        />
        <div className="space-y-1">
          <p className="text-sm font-medium">Generated thumbnail</p>
          <p className="text-xs text-(--color-text-muted)">
            Status: {prompt.thumbnailStatus}
            {prompt.thumbnailStatus === "FAILED" && prompt.thumbnailError ? ` - ${prompt.thumbnailError}` : ""}
          </p>
          <button
            type="button"
            disabled={regenerateMutation.isPending}
            className="rounded border border-(--color-border) bg-(--color-surface) px-2 py-1 text-xs"
            onClick={() => {
              regenerateMutation.mutate();
            }}
          >
            {regenerateMutation.isPending ? "Regenerating..." : "Regenerate image"}
          </button>
        </div>
      </div>
      <input
        name="title"
        defaultValue={prompt.title}
        placeholder="Title"
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <input
        name="summary"
        defaultValue={prompt.summary ?? ""}
        placeholder="Summary"
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <input
        name="modelHint"
        key={`modelHint-${prompt.id}`}
        defaultValue={prompt.modelHint ?? ""}
        placeholder="Model hint (optional, e.g. recommended model or stack)"
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <div className="grid gap-2 md:grid-cols-3">
        <select
          name="status"
          defaultValue={prompt.status}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          name="visibility"
          defaultValue={prompt.visibility}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="PUBLIC">Public (All Users)</option>
          <option value="TEAM">Team (My OU Only)</option>
          <option value="PRIVATE">Private (Only Me)</option>
        </select>
        <select
          name="modality"
          defaultValue={prompt.modality}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
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
      <div className="space-y-2 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
        <p className="text-sm font-medium">Tags</p>
        {tagsQuery.isLoading ? <p className="text-xs text-(--color-text-muted)">Loading tags…</p> : null}
        {!tagsQuery.isLoading && !tagsQuery.data?.length ? (
          <p className="text-xs text-(--color-text-muted)">
            No workspace tags yet. Add tags when filtering the library, or ask an admin to seed tags.
          </p>
        ) : null}
        {tagsQuery.data && tagsQuery.data.length > 0 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {tagsQuery.data.map((tag) => (
              <label key={tag.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedTagIds.includes(tag.id)}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSelectedTagIds((current) =>
                      checked
                        ? current.includes(tag.id)
                          ? current
                          : [...current, tag.id]
                        : current.filter((id) => id !== tag.id),
                    );
                  }}
                />
                <span>{tag.name}</span>
              </label>
            ))}
          </div>
        ) : null}
      </div>
      <textarea
        name="body"
        defaultValue={prompt.body}
        placeholder="Prompt body (use [KEY] or {{KEY}} for variables)"
        className="h-48 w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <input
        name="changelog"
        defaultValue=""
        placeholder="Version note (optional, saved when the body changes)"
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 text-sm"
      />
      <section className="space-y-3 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Template variables (optional)</p>
            <p className="text-xs text-(--color-text-muted)">
              Define placeholders for dynamic content. Use <code className="rounded bg-(--color-surface) px-1">[KEY]</code> or{" "}
              <code className="rounded bg-(--color-surface) px-1">{"{{KEY}}"}</code> in your prompt body above, then add the
              matching key here to let users fill in values when using this prompt.
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
        {variableRows.length === 0 ? (
          <p className="text-sm text-(--color-text-muted)">No variables yet. Add one to make this prompt customizable, or leave it as-is.</p>
        ) : (
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
                    placeholder="Display name"
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
                  Required before copy / launch
                </label>
                <div className="md:col-span-2">
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
        )}
      </section>
      <button
        type="submit"
        className="rounded bg-(--color-primary) px-4 py-2 text-(--color-text-inverse) hover:bg-(--color-primary-active) active:bg-(--color-primary-active)"
      >
        Save Changes
      </button>
    </form>
  );
}
