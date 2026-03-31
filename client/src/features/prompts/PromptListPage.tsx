import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listPrompts } from "./api";

export function PromptListPage() {
  const promptsQuery = useQuery({ queryKey: ["prompts"], queryFn: listPrompts });

  if (promptsQuery.isLoading) {
    return <p>Loading prompts...</p>;
  }

  if (promptsQuery.error) {
    return <p className="text-red-700">Failed to load prompts.</p>;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-semibold">Prompt Discovery</h2>
      {promptsQuery.data?.map((prompt) => (
        <Link key={prompt.id} to={`/prompts/${prompt.id}`} className="block rounded border bg-white p-4">
          <p className="font-semibold">{prompt.title}</p>
          <p className="text-sm text-slate-600">{prompt.summary ?? "No summary"}</p>
        </Link>
      ))}
    </div>
  );
}
