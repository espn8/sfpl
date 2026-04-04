import { useQuery } from "@tanstack/react-query";
import { getAnalyticsOverview } from "./api";

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

export function AnalyticsPage() {
  const analyticsQuery = useQuery({ queryKey: ["analytics", "overview"], queryFn: getAnalyticsOverview });

  if (analyticsQuery.isLoading) {
    return <p>Loading analytics...</p>;
  }

  if (!analyticsQuery.data) {
    return <p className="text-red-700">Analytics unavailable.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Analytics Overview</h2>
      <section className="space-y-2 rounded border border-(--color-border) bg-(--color-surface) p-4">
        <h3 className="font-semibold">Top Used Prompts</h3>
        {analyticsQuery.data.topUsedPrompts.map((item) => (
          <p key={item.id} className="text-sm text-(--color-text-muted)">
            {item.title} - {pluralize(item.usageCount, "use")}
          </p>
        ))}
      </section>
      <section className="space-y-2 rounded border border-(--color-border) bg-(--color-surface) p-4">
        <h3 className="font-semibold">{analyticsQuery.data.stalePrompts.length === 1 ? "Stale Prompt" : "Stale Prompts"}</h3>
        {analyticsQuery.data.stalePrompts.map((item) => (
          <p key={item.id} className="text-sm text-(--color-text-muted)">
            {item.title}
          </p>
        ))}
      </section>
    </div>
  );
}
