import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  getPrompt,
  PROMPT_MODALITY_OPTIONS,
  PROMPT_TOOL_OPTIONS,
  type PromptModality,
  type PromptTool,
  regeneratePromptThumbnail,
  updatePrompt,
} from "./api";
import { PromptThumbnail } from "./PromptThumbnail";

export function PromptEditPage() {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const promptId = Number(params.id);

  const promptQuery = useQuery({
    queryKey: ["prompt", promptId],
    queryFn: () => getPrompt(promptId),
    enabled: Number.isInteger(promptId) && promptId > 0,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      title: string;
      summary: string;
      body: string;
      status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
      visibility: "PUBLIC" | "PRIVATE";
      tools: PromptTool[];
      modality: PromptModality;
    }) =>
      updatePrompt(promptId, payload),
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

  if (promptQuery.isLoading) {
    return <p>Loading prompt...</p>;
  }

  if (!promptQuery.data) {
    return <p className="text-red-700">Prompt not found.</p>;
  }

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
        const selectedTools = formData
          .getAll("tools")
          .map((value) => String(value))
          .filter((value): value is PromptTool => PROMPT_TOOL_OPTIONS.includes(value as PromptTool));
        const modality = String(formData.get("modality") ?? "").trim();
        if (!title || !body || selectedTools.length === 0 || !PROMPT_MODALITY_OPTIONS.includes(modality as PromptModality)) {
          return;
        }
        updateMutation.mutate({
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
      <h2 className="text-2xl font-semibold">Edit Prompt</h2>
      <div className="flex items-center gap-3 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
        <PromptThumbnail
          title={promptQuery.data.title}
          thumbnailUrl={promptQuery.data.thumbnailUrl}
          thumbnailStatus={promptQuery.data.thumbnailStatus}
          className="h-20 w-20 rounded object-cover"
        />
        <div className="space-y-1">
          <p className="text-sm font-medium">Generated thumbnail</p>
          <p className="text-xs text-(--color-text-muted)">
            Status: {promptQuery.data.thumbnailStatus}
            {promptQuery.data.thumbnailStatus === "FAILED" && promptQuery.data.thumbnailError
              ? ` - ${promptQuery.data.thumbnailError}`
              : ""}
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
        defaultValue={promptQuery.data.title}
        placeholder="Title"
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <input
        name="summary"
        defaultValue={promptQuery.data.summary ?? ""}
        placeholder="Summary"
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <div className="grid gap-2 md:grid-cols-2">
        <select
          name="status"
          defaultValue={promptQuery.data.status}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          name="visibility"
          defaultValue={promptQuery.data.visibility}
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
            {PROMPT_TOOL_OPTIONS.map((tool) => (
              <label key={tool} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="tools" value={tool} defaultChecked={promptQuery.data.tools.includes(tool)} />
                <span>{tool}</span>
              </label>
            ))}
          </div>
        </div>
        <select
          name="modality"
          defaultValue={promptQuery.data.modality}
          className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          {PROMPT_MODALITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <textarea
        name="body"
        defaultValue={promptQuery.data.body}
        placeholder="Prompt body"
        className="h-48 w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <button
        type="submit"
        className="rounded bg-(--color-primary) px-4 py-2 text-(--color-text-inverse) hover:bg-(--color-primary-active) active:bg-(--color-primary-active)"
      >
        Save Changes
      </button>
    </form>
  );
}
