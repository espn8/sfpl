import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { createPrompt } from "./api";

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
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const title = String(formData.get("title") ?? "").trim();
        const summary = String(formData.get("summary") ?? "").trim();
        const body = String(formData.get("body") ?? "").trim();
        if (!title || !body) {
          return;
        }
        createMutation.mutate({ title, summary, body });
      }}
    >
      <h2 className="text-2xl font-semibold">Create Prompt</h2>
      <input name="title" placeholder="Title" className="w-full rounded border px-3 py-2" />
      <input name="summary" placeholder="Summary" className="w-full rounded border px-3 py-2" />
      <textarea name="body" placeholder="Prompt body" className="h-48 w-full rounded border px-3 py-2" />
      <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
        Save Prompt
      </button>
    </form>
  );
}
