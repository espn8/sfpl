import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import {
  createPrompt,
  PROMPT_MODALITY_OPTIONS,
  PROMPT_TOOL_OPTIONS,
  type PromptModality,
  type PromptTool,
} from "./api";

export function PromptEditorPage() {
  const navigate = useNavigate();
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
        const visibility = String(formData.get("visibility") ?? "TEAM") as "TEAM" | "PRIVATE";
        const selectedTools = formData
          .getAll("tools")
          .map((value) => String(value))
          .filter((value): value is PromptTool => PROMPT_TOOL_OPTIONS.includes(value as PromptTool));
        const modality = String(formData.get("modality") ?? "").trim();
        if (!title || !body || selectedTools.length === 0 || !PROMPT_MODALITY_OPTIONS.includes(modality as PromptModality)) {
          return;
        }
        createMutation.mutate({
          title,
          summary,
          body,
          status,
          visibility,
          tools: selectedTools,
          modality: modality as PromptModality,
        });
      }}
    >
      <h2 className="text-2xl font-semibold">Create Prompt</h2>
      <input
        name="title"
        placeholder="Title"
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <input
        name="summary"
        placeholder="Summary"
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
          defaultValue="TEAM"
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="TEAM">Team</option>
          <option value="PRIVATE">Private</option>
        </select>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-2 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
          <p className="text-sm font-medium">Tools (select one or many)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PROMPT_TOOL_OPTIONS.map((tool) => (
              <label key={tool} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="tools" value={tool} />
                <span>{tool}</span>
              </label>
            ))}
          </div>
        </div>
        <select
          name="modality"
          defaultValue=""
          className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="" disabled>
            Modality (required)
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
        placeholder="Prompt body"
        className="h-48 w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <button
        type="submit"
        className="rounded bg-(--color-primary) px-4 py-2 text-(--color-text-inverse) hover:bg-(--color-primary-active) active:bg-(--color-primary-active)"
      >
        Save Prompt
      </button>
    </form>
  );
}
