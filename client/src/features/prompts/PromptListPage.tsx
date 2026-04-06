import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMe } from "../auth/api";
import { canAccessAdminUi } from "../auth/roles";
import { getAnalyticsOverview } from "../analytics/api";
import { listCollections } from "../collections/api";
import { listTags } from "../tags/api";
import { listPrompts, type ListPromptsFilters, PROMPT_MODALITY_OPTIONS, PROMPT_TOOL_OPTIONS } from "./api";
import { PromptListCard } from "./PromptListCard";

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

type HeroStatIconVariant = "published" | "people" | "activity";

function HeroStatIcon({ variant }: { variant: HeroStatIconVariant }) {
  const className = "h-7 w-7 shrink-0 text-(--color-text)";
  if (variant === "published") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M12 3v3M12 18v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M3 12h3M18 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (variant === "people") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

type StatCounterProps = { end: number; active: boolean; delayMs?: number };

function StatCounter({ end, active, delayMs = 0 }: StatCounterProps) {
  const [display, setDisplay] = useState(0);
  const durationMs = 1200;

  useEffect(() => {
    if (!active) {
      setDisplay(0);
      return;
    }

    const prefersReduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setDisplay(end);
      return;
    }

    setDisplay(0);
    let frameId = 0;
    const startAfter = window.setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = 1 - (1 - t) ** 3;
        setDisplay(Math.round(end * eased));
        if (t < 1) {
          frameId = requestAnimationFrame(tick);
        }
      };
      frameId = requestAnimationFrame(tick);
    }, delayMs);

    return () => {
      window.clearTimeout(startAfter);
      cancelAnimationFrame(frameId);
    };
  }, [end, active, durationMs, delayMs]);

  return <span className="text-3xl font-bold tabular-nums tracking-tight md:text-4xl">{display.toLocaleString()}</span>;
}

export function PromptListPage() {
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [tool, setTool] = useState("");
  const [modality, setModality] = useState("");
  const [sort, setSort] = useState<"recent" | "topRated" | "mostUsed">("recent");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filters = useMemo<ListPromptsFilters>(() => {
    const nextFilters: ListPromptsFilters = {
      page,
      pageSize,
      sort,
    };
    if (search.trim()) {
      nextFilters.q = search.trim();
    }
    if (tag) {
      nextFilters.tag = tag;
    }
    if (collectionId) {
      nextFilters.collectionId = Number(collectionId);
    }
    if (tool) {
      nextFilters.tool = tool as (typeof PROMPT_TOOL_OPTIONS)[number];
    }
    if (modality) {
      nextFilters.modality = modality as (typeof PROMPT_MODALITY_OPTIONS)[number];
    }
    return nextFilters;
  }, [collectionId, modality, page, search, sort, tag, tool]);

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    retry: false,
  });
  const canViewAnalytics = Boolean(meQuery.data && canAccessAdminUi(meQuery.data.role));

  const promptsQuery = useQuery({
    queryKey: ["prompts", filters],
    queryFn: () => listPrompts(filters),
  });
  const tagsQuery = useQuery({ queryKey: ["tags"], queryFn: listTags });
  const collectionsQuery = useQuery({ queryKey: ["collections"], queryFn: listCollections });
  const analyticsQuery = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: getAnalyticsOverview,
    enabled: canViewAnalytics,
  });

  if (promptsQuery.isLoading) {
    return <p>Loading prompts...</p>;
  }

  if (promptsQuery.error) {
    return <p className="text-red-700">Failed to load prompts.</p>;
  }

  const promptTotal = promptsQuery.data?.meta.total ?? 0;
  const contributorTotal = analyticsQuery.data?.contributors.length ?? 0;
  const totalPromptRuns = analyticsQuery.data?.topUsedPrompts.reduce((total, prompt) => total + prompt.usageCount, 0) ?? 0;
  const analyticsReady = analyticsQuery.isSuccess;
  const heroStats = canViewAnalytics
    ? ([
        {
          icon: "published" as const,
          label: promptTotal === 1 ? "Prompt Published" : "Prompts Published",
          value: promptTotal,
          counterActive: true,
        },
        {
          icon: "people" as const,
          label: contributorTotal === 1 ? "Active Contributor" : "Active Contributors",
          value: contributorTotal,
          counterActive: analyticsReady,
        },
        {
          icon: "activity" as const,
          label: totalPromptRuns === 1 ? "Total Prompt Run" : "Total Prompt Runs",
          value: totalPromptRuns,
          counterActive: analyticsReady,
        },
      ] as const)
    : ([
        {
          icon: "published" as const,
          label: promptTotal === 1 ? "Prompt Published" : "Prompts Published",
          value: promptTotal,
          counterActive: true,
        },
      ] as const);
  const featuredPrompts = (promptsQuery.data?.data ?? []).slice(0, 6);

  const contributorLeaderboard = (analyticsQuery.data?.contributors ?? []).slice(0, 5);
  const usersLeaderboard = (analyticsQuery.data?.userEngagementLeaderboard ?? []).slice(0, 5);

  const aiToolAudience = [
    "Prompt engineers building repeatable workflows",
    "Sales teams writing account-ready outreach",
    "Developers generating code, SQL, and debugging helpers",
    "Marketing and content teams shipping campaigns faster",
  ] as const;

  const howItWorksSteps = [
    { step: "1", title: "Discover", description: "Browse top-performing prompts by category, role, and business objective." },
    { step: "2", title: "Customize", description: "Swap in your audience, tone, offer, and context with reusable variables." },
    { step: "3", title: "Launch", description: "Run in your preferred AI tool and immediately put results into production." },
    { step: "4", title: "Scale", description: "Save favorites, publish to collections, and compound team-wide wins." },
  ] as const;

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-2xl border border-(--color-border) bg-linear-to-br from-(--color-primary)/25 via-(--color-surface) to-(--color-surface-muted) p-6 shadow-sm transition-all duration-300 motion-reduce:transition-none">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-(--color-primary)/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-(--color-primary)/10 blur-3xl" />
        <div className="space-y-3">
          <p className="inline-block rounded-full border border-(--color-border) bg-(--color-surface) px-3 py-1 text-xs font-semibold tracking-[0.14em]">
            Prompt Library Platform
          </p>
          <h2 className="text-3xl font-bold md:text-4xl">Discover the magic behind every winning AI response</h2>
          <p className="max-w-3xl text-(--color-text-muted)">
            Find proven prompts, personalize them for your context, and launch in seconds. Built for Salesforce
            and every AI power user who needs better outcomes, faster.
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-3">
          <div className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) px-4 py-5 transition-all duration-300 motion-reduce:transition-none sm:px-6 sm:py-6">
            <p className="text-xs uppercase tracking-wide text-(--color-text-muted)">Live platform snapshot</p>
            <div
              className={`mt-5 grid w-full gap-8 ${canViewAnalytics ? "sm:grid-cols-3" : "grid-cols-1"}`}
              role="list"
              aria-label="Platform statistics"
            >
              {heroStats.map((stat, index) => (
                <div
                  key={stat.label}
                  role="listitem"
                  className="flex flex-col items-center gap-2 text-center sm:items-center"
                >
                  <HeroStatIcon variant={stat.icon} />
                  <StatCounter end={stat.value} active={stat.counterActive} delayMs={index * 90} />
                  <p className="text-sm text-(--color-text-muted)">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) p-4 transition-all duration-300 motion-reduce:transition-none">
            <p className="text-xs uppercase tracking-wide text-(--color-text-muted)">What you unlock</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Ship trusted prompts for high-stakes workflows</li>
              <li>
                Community Driven: Rate prompts, view the leaderboards, follow your favorite prompt
                gurus, and get inspired.
              </li>
              <li>Scale what works with shared collections and rankings</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            to="/prompts/new"
            className="rounded-lg bg-(--color-primary) px-3 py-2 text-sm font-semibold text-(--color-text-inverse) shadow-sm transition hover:bg-(--color-primary-active)"
          >
            Create Winning Prompt
          </Link>
          <Link
            to="/collections"
            className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm font-semibold transition hover:border-(--color-primary) hover:bg-(--color-surface-muted)"
          >
            Explore Collections
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Featured Prompts</h3>
          <span className="text-sm font-medium text-(--color-text-muted)">Highest impact this week</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {featuredPrompts.map((prompt) => (
            <PromptListCard key={prompt.id} prompt={prompt} variant="featured" />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-5 shadow-sm transition-all duration-300 hover:shadow motion-reduce:transition-none">
        <h3 className="text-xl font-semibold">How Prompt Library Works</h3>
        <ol className="mt-6 flex list-none flex-col gap-0 p-0 md:mt-8 md:flex-row md:items-stretch">
          {howItWorksSteps.map((item, index) => {
            const isFirst = index === 0;
            const isLast = index === howItWorksSteps.length - 1;
            return (
              <li key={item.step} className="flex flex-1 flex-col md:min-w-0">
                <div className="mb-3 hidden items-center md:flex" aria-hidden>
                  <div className={`h-0.5 min-w-2 flex-1 rounded-full ${isFirst ? "bg-transparent" : "bg-(--color-primary)/40"}`} />
                  <div className="mx-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-(--color-primary) bg-(--color-surface) text-sm font-bold text-(--color-primary) shadow-sm ring-4 ring-(--color-surface)">
                    {item.step}
                  </div>
                  <div className={`h-0.5 min-w-2 flex-1 rounded-full ${isLast ? "bg-transparent" : "bg-(--color-primary)/40"}`} />
                </div>
                <div className="flex min-h-0 flex-1 gap-3 md:block md:gap-0">
                  <div className="flex flex-col items-center self-stretch md:hidden" aria-hidden>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-(--color-primary) bg-(--color-surface) text-sm font-bold text-(--color-primary) shadow-sm">
                      {item.step}
                    </div>
                    {!isLast ? <div className="mt-2 w-px flex-1 bg-(--color-primary)/35" /> : null}
                  </div>
                  <div className="min-w-0 flex-1 pb-6 md:pb-0">
                    <article className="h-full rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-3 transition-transform duration-300 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none md:flex md:flex-col">
                      <p className="sr-only">
                        Step {item.step}: {item.title}
                      </p>
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-1 text-sm text-(--color-text-muted) md:flex-1">{item.description}</p>
                    </article>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-5 shadow-sm transition-all duration-300 hover:shadow motion-reduce:transition-none">
        <h3 className="text-xl font-semibold">Built for Every AI Tool & User</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-4 transition-all duration-300 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none">
            <p className="font-semibold">Wherever you work</p>
            <p className="mt-1 text-sm text-(--color-text-muted)">
              Prompt Library supports amazing prompts across Cursor, Claude, Gemini, Notebook LM, and beyond.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {PROMPT_TOOL_OPTIONS.map((toolOption) => (
                <span
                  key={toolOption}
                  className="rounded-full border border-(--color-border) bg-(--color-surface) px-2 py-1 font-medium"
                >
                  {toolOption}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-4 transition-all duration-300 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none">
            <p className="font-semibold">Who benefits</p>
            <ul className="mt-2 space-y-1 text-sm text-(--color-text-muted)">
              {aiToolAudience.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {canViewAnalytics ? (
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-5 shadow-sm transition-all duration-300 hover:shadow motion-reduce:transition-none">
          <h3 className="text-xl font-semibold">Contributors Leaderboard</h3>
          <p className="mt-1 text-sm text-(--color-text-muted)">Contributors driving AI adoption</p>
          <div className="mt-3 space-y-2">
            {contributorLeaderboard.map((contributor, index) => (
              <div
                key={contributor.id}
                className="flex items-center justify-between rounded-xl border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 transition-all duration-300 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none"
              >
                <p className="font-medium">
                  <span className="mr-2 inline-flex min-w-6 justify-center rounded-md bg-(--color-surface) px-1.5 py-0.5 text-xs">
                    #{index + 1}
                  </span>
                  {contributor.name ?? contributor.email}
                </p>
                <p className="text-sm text-(--color-text-muted)">{pluralize(contributor.promptCount, "prompt")}</p>
              </div>
            ))}
            {contributorLeaderboard.length === 0 ? (
              <p className="text-sm text-(--color-text-muted)">Leaderboard data will appear as your team contributes.</p>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-5 shadow-sm transition-all duration-300 hover:shadow motion-reduce:transition-none">
          <h3 className="text-xl font-semibold">Users Leaderboard</h3>
          <p className="mt-1 text-sm text-(--color-text-muted)">Top users based on utilization and feedback</p>
          <div className="mt-3 space-y-2">
            {usersLeaderboard.map((user, index) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-xl border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 transition-all duration-300 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none"
              >
                <p className="font-medium">
                  <span className="mr-2 inline-flex min-w-6 justify-center rounded-md bg-(--color-surface) px-1.5 py-0.5 text-xs">
                    #{index + 1}
                  </span>
                  {user.name ?? user.email}
                </p>
                <p className="text-sm text-(--color-text-muted)">
                  Score {user.score} ({pluralize(user.usedCount, "use")}, {pluralize(user.favoritedCount, "favorite")},{" "}
                  {pluralize(user.feedbackCount, "feedback", "feedback")})
                </p>
              </div>
            ))}
            {usersLeaderboard.length === 0 ? (
              <p className="text-sm text-(--color-text-muted)">User leaderboard updates as engagement activity comes in.</p>
            ) : null}
          </div>
        </div>
      </section>
      ) : null}

      <h3 className="text-2xl font-semibold">Prompt Discovery</h3>
      <div className="grid gap-2 rounded border border-(--color-border) bg-(--color-surface) p-3 md:grid-cols-2">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
          placeholder="Search title, summary, or body"
        />
        <select
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as "recent" | "topRated" | "mostUsed");
            setPage(1);
          }}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="recent">Sort: Most recent</option>
          <option value="topRated">Sort: Top rated</option>
          <option value="mostUsed">Sort: Most used</option>
        </select>
        <select
          value={tag}
          onChange={(event) => {
            setTag(event.target.value);
            setPage(1);
          }}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="">All tags</option>
          {tagsQuery.data?.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          value={tool}
          onChange={(event) => {
            setTool(event.target.value);
            setPage(1);
          }}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="">All tools</option>
          {PROMPT_TOOL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={modality}
          onChange={(event) => {
            setModality(event.target.value);
            setPage(1);
          }}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="">All modalities</option>
          {PROMPT_MODALITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={collectionId}
          onChange={(event) => {
            setCollectionId(event.target.value);
            setPage(1);
          }}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 md:col-span-2"
        >
          <option value="">All collections</option>
          {collectionsQuery.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      {promptsQuery.data?.data.map((prompt) => (
        <PromptListCard key={prompt.id} prompt={prompt} variant="default" />
      ))}
      {promptsQuery.data && promptsQuery.data.meta.totalPages > 1 ? (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={promptsQuery.data.meta.page <= 1}
            className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1.5 disabled:opacity-50"
            onClick={() => {
              setPage((current) => Math.max(1, current - 1));
            }}
          >
            Previous
          </button>
          <p className="text-sm text-(--color-text-muted)">
            Page {promptsQuery.data.meta.page} of {promptsQuery.data.meta.totalPages}
          </p>
          <button
            type="button"
            disabled={promptsQuery.data.meta.page >= promptsQuery.data.meta.totalPages}
            className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1.5 disabled:opacity-50"
            onClick={() => {
              setPage((current) => Math.min(promptsQuery.data!.meta.totalPages, current + 1));
            }}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
