import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAnalyticsOverview } from "../analytics/api";
import { listCollections } from "../collections/api";
import { listTags } from "../tags/api";
import { listPrompts, type ListPromptsFilters, PROMPT_MODALITY_OPTIONS, PROMPT_TOOL_OPTIONS } from "./api";
import { PromptThumbnail } from "./PromptThumbnail";

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

  const promptsQuery = useQuery({
    queryKey: ["prompts", filters],
    queryFn: () => listPrompts(filters),
  });
  const tagsQuery = useQuery({ queryKey: ["tags"], queryFn: listTags });
  const collectionsQuery = useQuery({ queryKey: ["collections"], queryFn: listCollections });
  const analyticsQuery = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: getAnalyticsOverview,
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      setHeroStatIndex((current) => (current + 1) % 3);
    }, 3500);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  if (promptsQuery.isLoading) {
    return <p>Loading prompts...</p>;
  }

  if (promptsQuery.error) {
    return <p className="text-red-700">Failed to load prompts.</p>;
  }

  const promptTotal = promptsQuery.data?.meta.total ?? 0;
  const contributorTotal = analyticsQuery.data?.contributors.length ?? 0;
  const totalPromptRuns = analyticsQuery.data?.topUsedPrompts.reduce((total, prompt) => total + prompt.usageCount, 0) ?? 0;
  const heroStats = [
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
  ] as const;

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
            <Link
              key={prompt.id}
              to={`/prompts/${prompt.id}`}
              className="block overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) p-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-(--color-primary) hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
            >
              <PromptThumbnail
                title={prompt.title}
                thumbnailUrl={prompt.thumbnailUrl}
                thumbnailStatus={prompt.thumbnailStatus}
                className="h-40 w-full object-cover"
              />
              <div className="p-4">
                <p className="truncate font-semibold">{prompt.title}</p>
                <p className="line-clamp-2 text-sm text-(--color-text-muted)">{prompt.summary ?? "No summary yet"}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-(--color-text-muted)">
                  <span className="rounded border border-(--color-border) px-2 py-1">{prompt.modality}</span>
                  <span className="rounded border border-(--color-border) px-2 py-1">{prompt.tools[0] ?? "general"}</span>
                  <span className="ml-auto">{pluralize(prompt.usageCount, "use")}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-5 shadow-sm transition-all duration-300 hover:shadow motion-reduce:transition-none">
        <h3 className="text-xl font-semibold">How Prompt Library Works</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            ["1", "Discover", "Browse top-performing prompts by category, role, and business objective."],
            ["2", "Customize", "Swap in your audience, tone, offer, and context with reusable variables."],
            ["3", "Launch", "Run in your preferred AI tool and immediately put results into production."],
            ["4", "Scale", "Save favorites, publish to collections, and compound team-wide wins."],
          ].map(([step, title, description]) => (
            <div
              key={step}
              className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-3 transition-transform duration-300 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none"
            >
              <p className="text-xs font-semibold uppercase text-(--color-text-muted)">Step {step}</p>
              <p className="mt-1 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-(--color-text-muted)">{description}</p>
            </div>
          ))}
        </div>
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
        <Link
          key={prompt.id}
          to={`/prompts/${prompt.id}`}
          className="block overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) p-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transform-none motion-reduce:transition-none"
        >
          <PromptThumbnail
            title={prompt.title}
            thumbnailUrl={prompt.thumbnailUrl}
            thumbnailStatus={prompt.thumbnailStatus}
            className="h-40 w-full object-cover"
          />
          <div className="p-4">
            <p className="font-semibold">{prompt.title}</p>
            <p className="text-sm text-(--color-text-muted)">{prompt.summary ?? "No summary"}</p>
          </div>
        </Link>
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
