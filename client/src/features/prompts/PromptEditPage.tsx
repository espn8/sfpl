import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { getPrompt, updatePrompt } from "./api";

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
      visibility: "TEAM" | "PRIVATE";
      modelHint?: string;
      modality?: string;
    }) =>
      updatePrompt(promptId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prompt", promptId] });
      await queryClient.invalidateQueries({ queryKey: ["prompts"] });
      navigate(`/prompts/${promptId}`);
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
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const title = String(formData.get("title") ?? "").trim();
        const summary = String(formData.get("summary") ?? "").trim();
        const body = String(formData.get("body") ?? "").trim();
        const status = String(formData.get("status") ?? "DRAFT") as "DRAFT" | "PUBLISHED" | "ARCHIVED";
        const visibility = String(formData.get("visibility") ?? "TEAM") as "TEAM" | "PRIVATE";
        const modelHint = String(formData.get("modelHint") ?? "").trim();
        const modality = String(formData.get("modality") ?? "").trim();
        if (!title || !body) {
          return;
        }
        updateMutation.mutate({
          title,
          summary,
          body,
          status,
          visibility,
          modelHint: modelHint || undefined,
          modality: modality || undefined,
        });
      }}
    >
      <h2 className="text-2xl font-semibold">Edit Prompt</h2>
      <input
        name="title"
        defaultValue={promptQuery.data.title}
        placeholder="Title"
        className="w-full rounded border px-3 py-2"
      />
      <input
        name="summary"
        defaultValue={promptQuery.data.summary ?? ""}
        placeholder="Summary"
        className="w-full rounded border px-3 py-2"
      />
      <div className="grid gap-2 md:grid-cols-2">
        <select name="status" defaultValue={promptQuery.data.status} className="rounded border px-3 py-2">
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select name="visibility" defaultValue={promptQuery.data.visibility} className="rounded border px-3 py-2">
          <option value="TEAM">Team</option>
          <option value="PRIVATE">Private</option>
        </select>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <input
          name="modelHint"
          defaultValue={promptQuery.data.modelHint ?? ""}
          placeholder="Model hint (optional)"
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="modality"
          defaultValue={promptQuery.data.modality ?? ""}
          placeholder="Modality (optional)"
          className="w-full rounded border px-3 py-2"
        />
      </div>
      <textarea
        name="body"
        defaultValue={promptQuery.data.body}
        placeholder="Prompt body"
        className="h-48 w-full rounded border px-3 py-2"
      />
      <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
        Save Changes
      </button>
    </form>
  );
}
