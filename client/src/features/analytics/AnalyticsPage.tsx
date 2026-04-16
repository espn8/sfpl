import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getAnalyticsOverview } from "./api";

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function formatRating(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(1);
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function StarIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M10 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L10 2z" />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2M6 3h12v6a6 6 0 0 1-12 0V3zM9 21h6M12 15v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type SectionCardProps = {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  emptyMessage?: string;
  isEmpty?: boolean;
};

function SectionCard({ title, icon, children, emptyMessage = "No data available.", isEmpty }: SectionCardProps) {
  return (
    <section className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-hidden">
      <div className="flex items-center gap-2 border-b border-(--color-border) bg-(--color-surface-muted) px-4 py-3">
        {icon}
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="p-4">
        {isEmpty ? (
          <p className="text-sm text-(--color-text-muted)">{emptyMessage}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export function AnalyticsPage() {
  const analyticsQuery = useQuery({ queryKey: ["analytics", "overview"], queryFn: getAnalyticsOverview });

  if (analyticsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-(--color-text-muted)">Just a moment...</p>
      </div>
    );
  }

  if (!analyticsQuery.data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
        <p className="text-red-700 dark:text-red-300">We couldn't load insights right now. Try refreshing.</p>
      </div>
    );
  }

  const { topUsedPrompts, topRatedPrompts, stalePrompts, contributors, userEngagementLeaderboard } = analyticsQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Insights</h2>
        <p className="mt-1 text-sm text-(--color-text-muted)">Usage metrics and engagement insights</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Most Used AI Assets"
          icon={<ChartIcon className="h-5 w-5 text-(--color-text-muted)" />}
          isEmpty={topUsedPrompts.length === 0}
          emptyMessage="No AI assets have been used yet."
        >
          <div className="space-y-2">
            {topUsedPrompts.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--color-primary) text-xs font-semibold text-(--color-text-inverse)">
                    {index + 1}
                  </span>
                  <Link
                    to={`/prompts/${item.id}`}
                    className="truncate text-sm font-medium hover:text-(--color-primary) hover:underline"
                  >
                    {item.title}
                  </Link>
                </div>
                <span className="shrink-0 rounded-full bg-(--color-surface) px-2 py-0.5 text-xs text-(--color-text-muted)">
                  {pluralize(item.usageCount, "use")}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Top Rated AI Assets"
          icon={<StarIcon className="h-5 w-5 text-(--color-text-muted)" filled />}
          isEmpty={topRatedPrompts.length === 0 || topRatedPrompts.every((p) => p.ratingCount === 0)}
          emptyMessage="No AI assets have been rated yet."
        >
          <div className="space-y-2">
            {topRatedPrompts
              .filter((item) => item.ratingCount > 0)
              .map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-semibold text-white dark:bg-amber-600">
                      {index + 1}
                    </span>
                    <Link
                      to={`/prompts/${item.id}`}
                      className="truncate text-sm font-medium hover:text-(--color-primary) hover:underline"
                    >
                      {item.title}
                    </Link>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <StarIcon className="h-4 w-4 text-amber-500" filled />
                    <span className="text-sm font-medium">{formatRating(item.averageRating)}</span>
                    <span className="text-xs text-(--color-text-muted)">({item.ratingCount})</span>
                  </div>
                </div>
              ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Top Contributors"
          icon={<UsersIcon className="h-5 w-5 text-(--color-text-muted)" />}
          isEmpty={contributors.length === 0 || contributors.every((c) => c.promptCount === 0)}
          emptyMessage="No contributors yet."
        >
          <div className="space-y-2">
            {contributors
              .filter((item) => item.promptCount > 0)
              .map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                        index === 0
                          ? "bg-amber-500"
                          : index === 1
                            ? "bg-gray-400"
                            : index === 2
                              ? "bg-amber-700"
                              : "bg-(--color-text-muted)"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.name ?? "Unknown"}</p>
                      <p className="truncate text-xs text-(--color-text-muted)">{item.email}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-(--color-surface) px-2 py-0.5 text-xs text-(--color-text-muted)">
                    {pluralize(item.promptCount, "AI asset")}
                  </span>
                </div>
              ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Engagement Leaderboard"
          icon={<TrophyIcon className="h-5 w-5 text-(--color-text-muted)" />}
          isEmpty={userEngagementLeaderboard.length === 0}
          emptyMessage="No engagement activity recorded yet."
        >
          <div className="space-y-2">
            {userEngagementLeaderboard.map((item, index) => (
              <div
                key={item.id}
                className="rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                        index === 0
                          ? "bg-amber-500"
                          : index === 1
                            ? "bg-gray-400"
                            : index === 2
                              ? "bg-amber-700"
                              : "bg-(--color-text-muted)"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.name ?? "Unknown"}</p>
                      <p className="truncate text-xs text-(--color-text-muted)">{item.email}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-(--color-primary) px-2.5 py-0.5 text-xs font-semibold text-(--color-text-inverse)">
                    {item.score} pts
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-(--color-text-muted)">
                  <span className="rounded bg-(--color-surface) px-1.5 py-0.5">{item.usedCount} uses</span>
                  <span className="rounded bg-(--color-surface) px-1.5 py-0.5">{item.favoritedCount} favorites</span>
                  <span className="rounded bg-(--color-surface) px-1.5 py-0.5">{item.feedbackCount} ratings</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Ready for a Refresh"
        icon={<ClockIcon className="h-5 w-5 text-(--color-text-muted)" />}
        isEmpty={stalePrompts.length === 0}
        emptyMessage="All AI assets have been used recently. Nice work!"
      >
        <p className="mb-3 text-xs text-(--color-text-muted)">
          AI assets with no usage in the last 30 days. Consider updating or archiving these.
        </p>
        <div className="space-y-2">
          {stalePrompts.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
            >
              <Link
                to={`/prompts/${item.id}`}
                className="truncate text-sm font-medium hover:text-(--color-primary) hover:underline"
              >
                {item.title}
              </Link>
              <span className="shrink-0 text-xs text-(--color-text-muted)">
                Updated {formatRelativeTime(item.updatedAt)}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
