import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { getPrompt, logUsage, ratePrompt, toggleFavorite, updatePrompt } from "./api";

export function PromptDetailPage() {
  const params = useParams();
  const promptId = Number(params.id);
  const [rating, setRating] = useState(5);
  const promptQuery = useQuery({
    queryKey: ["prompt", promptId],
    queryFn: () => getPrompt(promptId),
    enabled: Number.isInteger(promptId),
  });
  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: (payload: { body: string }) => updatePrompt(promptId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prompt", promptId] });
    },
  });

  useEffect(() => {
    if (Number.isInteger(promptId)) {
      void logUsage(promptId, "VIEW");
      trackEvent("prompt_view", { prompt_id: promptId });
    }
  }, [promptId]);

  const launchUrl = useMemo(() => {
    const body = promptQuery.data?.body ?? "";
    return `https://chat.openai.com/?model=gpt-4o&prompt=${encodeURIComponent(body)}`;
  }, [promptQuery.data?.body]);

  if (promptQuery.isLoading) {
    return <p>Loading prompt...</p>;
  }

  if (!promptQuery.data) {
    return <p className="text-red-700">Prompt not found.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">{promptQuery.data.title}</h2>
      <p>{promptQuery.data.summary}</p>
      <textarea
        className="h-56 w-full rounded border px-3 py-2"
        defaultValue={promptQuery.data.body}
        onBlur={(event) => {
          const body = event.target.value;
          if (body && body !== promptQuery.data?.body) {
            updateMutation.mutate({ body });
          }
        }}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded border px-3 py-1.5"
          onClick={() => {
            void navigator.clipboard.writeText(promptQuery.data?.body ?? "");
            void logUsage(promptId, "COPY");
            trackEvent("prompt_copy", { prompt_id: promptId });
          }}
        >
          Copy
        </button>
        <a
          href={launchUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded border px-3 py-1.5"
          onClick={() => {
            void logUsage(promptId, "LAUNCH");
            trackEvent("prompt_launch", { prompt_id: promptId });
          }}
        >
          Launch
        </a>
        <button
          type="button"
          className="rounded border px-3 py-1.5"
          onClick={() => {
            void toggleFavorite(promptId);
            trackEvent("prompt_favorite_toggle", { prompt_id: promptId });
          }}
        >
          Favorite
        </button>
        <select
          value={rating}
          className="rounded border px-2"
          onChange={(event) => {
            setRating(Number(event.target.value));
          }}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value} star
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded border px-3 py-1.5"
          onClick={() => {
            void ratePrompt(promptId, rating);
            trackEvent("prompt_rate", { prompt_id: promptId, value: rating });
          }}
        >
          Submit Rating
        </button>
      </div>
    </div>
  );
}
