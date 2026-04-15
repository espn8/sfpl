import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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

type HeroStatIconVariant = "published" | "people" | "views";

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
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
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
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    return <p>Loading your prompts...</p>;
  }

  if (promptsQuery.error) {
    return <p className="text-red-700">We couldn't load prompts right now. Try refreshing.</p>;
  }

  const snapshot = promptsQuery.data?.meta.snapshot;
  const promptsPublished = snapshot?.promptsPublished ?? 0;
  const activeUsers = snapshot?.activeUsers ?? 0;
  const promptsViewed = snapshot?.promptsViewed ?? 0;
  const snapshotReady = promptsQuery.isSuccess;
  const heroStats = [
    {
      icon: "published" as const,
      label: "Prompts Published",
      value: promptsPublished,
      counterActive: snapshotReady,
    },
    {
      icon: "people" as const,
      label: "Active Users",
      value: activeUsers,
      counterActive: snapshotReady,
    },
    {
      icon: "views" as const,
      label: "Prompts Viewed",
      value: promptsViewed,
      counterActive: snapshotReady,
    },
  ] as const;
  const featuredPrompts = (promptsQuery.data?.data ?? []).slice(0, 6);

  const contributorLeaderboard = (analyticsQuery.data?.contributors ?? []).slice(0, 5);
  const usersLeaderboard = (analyticsQuery.data?.userEngagementLeaderboard ?? []).slice(0, 5);

  const aiToolAudience = [
    "Prompt engineers building repeatable, scalable workflows",
    "Salespeople crafting personalized, account-ready outreach",
    "Developers generating code, SQL, and debugging solutions faster",
    "Marketers and content creators shipping campaigns at AI speed",
  ] as const;

  const howItWorksSteps = [
    { step: "1", title: "Discover", description: "Browse prompts built by Salesforce experts across every role and use case." },
    { step: "2", title: "Customize", description: "Fill in variables to tailor any prompt to your specific context and audience." },
    { step: "3", title: "Launch", description: "Open directly in Slackbot, Claude, Gemini, or Cursor with one click." },
    { step: "4", title: "Scale", description: "Save your favorites, build collections, and share what works." },
  ] as const;

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-2xl border border-(--color-border) bg-linear-to-br from-(--color-primary)/25 via-(--color-surface) to-(--color-surface-muted) p-6 shadow-sm transition-all duration-300 motion-reduce:transition-none">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-(--color-primary)/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-(--color-primary)/10 blur-3xl" />
        <div className="space-y-3">
          <p className="inline-block rounded-full border border-(--color-border) bg-(--color-surface) px-3 py-1 text-xs font-semibold tracking-[0.14em]">
            Your AI Advantage Starts Here
          </p>
          <h2 className="text-3xl font-bold md:text-4xl">Find the prompts that get results. Share the ones you've perfected.</h2>
          <p className="max-w-3xl text-(--color-text-muted)">
            Browse battle-tested prompts from fellow Salesforce employees, customize them for your work, and launch directly into your favorite AI tool. No more starting from scratch.
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-3">
          <div className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) px-4 py-5 transition-all duration-300 motion-reduce:transition-none sm:px-6 sm:py-6">
            <p className="text-xs uppercase tracking-wide text-(--color-text-muted)">See what's happening now</p>
            <div
              className="mt-5 grid w-full grid-cols-1 gap-8 sm:grid-cols-3"
              role="list"
              aria-label="Platform statistics"
            >
              {heroStats.map((stat, index) => (
                <div
                  key={stat.label}
                  role="listitem"
                  className="flex flex-col items-center gap-2 text-center"
                >
                  <HeroStatIcon variant={stat.icon} />
                  <StatCounter end={stat.value} active={stat.counterActive} delayMs={index * 90} />
                  <p className="text-sm text-(--color-text-muted)">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Top Performers This Week</h3>
          <span className="text-sm font-medium text-(--color-text-muted)">The prompts people can't stop using</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {featuredPrompts.map((prompt) => (
            <PromptListCard key={prompt.id} prompt={prompt} variant="featured" />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-5 shadow-sm transition-all duration-300 hover:shadow motion-reduce:transition-none">
        <h3 className="text-xl font-semibold">How SF AI Library Works</h3>
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
        <h3 className="text-xl font-semibold">Works Where You Work</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-(--color-border) bg-(--color-surface-muted) p-4 transition-all duration-300 hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none">
            <p className="font-semibold">Your tools, ready to go</p>
            <p className="mt-1 text-sm text-(--color-text-muted)">
              SF AI Library connects seamlessly with Slackbot, Cursor, Claude, Gemini, NotebookLM, and more. Pick your tool and get to work.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {[...PROMPT_TOOL_OPTIONS]
                .sort((a, b) => {
                  if (a === "slackbot") return -1;
                  if (b === "slackbot") return 1;
                  return a.localeCompare(b);
                })
                .map((toolOption) => (
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
            <p className="font-semibold">Built for people like you</p>
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
          <h3 className="text-xl font-semibold">Top Contributors</h3>
          <p className="mt-1 text-sm text-(--color-text-muted)">The people driving AI adoption forward</p>
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
              <p className="text-sm text-(--color-text-muted)">Be the first to contribute and claim your spot.</p>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-5 shadow-sm transition-all duration-300 hover:shadow motion-reduce:transition-none">
          <h3 className="text-xl font-semibold">Most Active</h3>
          <p className="mt-1 text-sm text-(--color-text-muted)">The most engaged users</p>
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
              <p className="text-sm text-(--color-text-muted)">Start engaging to see active users here.</p>
            ) : null}
          </div>
        </div>
      </section>
      ) : null}

      <h3 className="text-2xl font-semibold">Explore Prompts</h3>
      <div className="grid gap-2 rounded border border-(--color-border) bg-(--color-surface) p-3 md:grid-cols-2">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
          placeholder="Search by keyword, use case, or author..."
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
          <option value="">All generated output</option>
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
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
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
