import { useQuery } from "@tanstack/react-query";
import { getAnalyticsOverview } from "./api";

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
      <section>
        <h3 className="font-semibold">Top Used</h3>
        {analyticsQuery.data.topUsedPrompts.map((item) => (
          <p key={item.id} className="text-sm">
            {item.title} - {item.usageCount}
          </p>
        ))}
      </section>
      <section>
        <h3 className="font-semibold">Stale Prompts</h3>
        {analyticsQuery.data.stalePrompts.map((item) => (
          <p key={item.id} className="text-sm">
            {item.title}
          </p>
        ))}
      </section>
    </div>
  );
}
