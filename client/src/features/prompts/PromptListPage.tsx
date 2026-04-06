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

export function PromptListPage() {
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [tool, setTool] = useState("");
  const [modality, setModality] = useState("");
  const [sort, setSort] = useState<"recent" | "topRated" | "mostUsed">("recent");
  const [page, setPage] = useState(1);
  const [heroStatIndex, setHeroStatIndex] = useState(0);
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

  const heroStatsLength = canViewAnalytics ? 3 : 1;

  useEffect(() => {
    setHeroStatIndex((current) => current % heroStatsLength);
  }, [heroStatsLength]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setHeroStatIndex((current) => (current + 1) % heroStatsLength);
    }, 3500);
    return () => {
      window.clearInterval(interval);
    };
  }, [heroStatsLength]);

  if (promptsQuery.isLoading) {
    return <p>Loading prompts...</p>;
  }

  if (promptsQuery.error) {
    return <p className="text-red-700">Failed to load prompts.</p>;
  }

  const promptTotal = promptsQuery.data?.meta.total ?? 0;
  const contributorTotal = analyticsQuery.data?.contributors.length ?? 0;
  const totalPromptRuns = analyticsQuery.data?.topUsedPrompts.reduce((total, prompt) => total + prompt.usageCount, 0) ?? 0;
  const heroStats = canViewAnalytics
    ? ([
        {
          label: promptTotal === 1 ? "Prompt Published" : "Prompts Published",
          value: promptTotal,
        },
        {
          label: contributorTotal === 1 ? "Active Contributor" : "Active Contributors",
          value: contributorTotal,
        },
        {
          label: totalPromptRuns === 1 ? "Total Prompt Run" : "Total Prompt Runs",
          value: totalPromptRuns,
        },
      ] as const)
    : ([
        {
          label: promptTotal === 1 ? "Prompt Published" : "Prompts Published",
          value: promptTotal,
        },
      ] as const);

  const currentHeroStat = heroStats[heroStatIndex];
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
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4 transition-all duration-300 motion-reduce:transition-none md:col-span-2">
            <p className="text-xs uppercase tracking-wide text-(--color-text-muted)">Live platform snapshot</p>
            <p key={`hero-stat-value-${heroStatIndex}`} className="mt-2 text-3xl font-bold motion-reduce:animate-none animate-pulse">
              {currentHeroStat.value.toLocaleString()}
            </p>
            <p
              key={`hero-stat-label-${heroStatIndex}`}
              className="text-sm text-(--color-text-muted) transition-opacity duration-300 motion-reduce:transition-none"
            >
              {currentHeroStat.label}
            </p>
            <div className="mt-3 flex items-center gap-2">
              {heroStats.map((stat, index) => (
                <span
                  key={stat.label}
                  className={`h-1.5 w-8 rounded-full ${index === heroStatIndex ? "bg-(--color-primary)" : "bg-(--color-border)"}`}
                />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4 transition-all duration-300 motion-reduce:transition-none">
            <p className="text-xs uppercase tracking-wide text-(--color-text-muted)">What you unlock</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Ship trusted prompts for high-stakes workflows</li>
              <li>Remix instantly for your exact audience and goal</li>
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
        <h3 className="text-xl font-semibold">Built for Salesforce by Salesforce</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-4 transition-all duration-300 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none">
            <p className="font-semibold">Sales Enablement Ready</p>
            <p className="mt-1 text-sm text-(--color-text-muted)">
              Standardize outreach, discovery, and objection handling by region, segment, and OU.
            </p>
          </div>
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-4 transition-all duration-300 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none">
            <p className="font-semibold">Governed Collaboration</p>
            <p className="mt-1 text-sm text-(--color-text-muted)">
              Publish team-approved templates while preserving quality with ratings, usage, and contributor visibility.
            </p>
          </div>
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-4 transition-all duration-300 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none">
            <p className="font-semibold">Global Team Discoverability</p>
            <p className="mt-1 text-sm text-(--color-text-muted)">
              Surface top creators and what works across AMER, EMEA, JAPAC, and LATAM in one shared hub.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-5 shadow-sm transition-all duration-300 hover:shadow motion-reduce:transition-none">
        <h3 className="text-xl font-semibold">Built for Every AI Tool & User</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-4 transition-all duration-300 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none">
            <p className="font-semibold">Where your teams work</p>
            <p className="mt-1 text-sm text-(--color-text-muted)">
              Prompt Library supports real workflows across Cursor, Claude, Gemini, NotebookLM, and beyond.
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
