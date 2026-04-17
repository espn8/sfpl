import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { fetchMe } from "../auth/api";
import { canAccessAdminUi } from "../auth/roles";
import { getAnalyticsOverview } from "../analytics/api";
import { listAssets, type ListAssetsFilters } from "../assets/api";
import { AssetCard } from "../assets/AssetCard";
import { getToolLabel, getToolsSortedAlphabetically, type PromptTool } from "../prompts/api";
import { FacetedFilters, SearchBar, useSearchState, type AssetTypeFilter } from "../search";
import { parseNaturalLanguageQuery } from "../search/api";

const FIRST_VISIT_KEY = "sf-ai-library-first-visit-completed";

function getFirstName(fullName: string | null | undefined): string {
  if (!fullName) return "";
  return fullName.split(" ")[0];
}

function usePersonalizedGreeting(userName: string | null | undefined) {
  const hasCheckedRef = useRef(false);
  const [isFirstVisit, setIsFirstVisit] = useState<boolean | null>(null);

  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const hasVisitedBefore = localStorage.getItem(FIRST_VISIT_KEY) === "true";
    setIsFirstVisit(!hasVisitedBefore);

    if (!hasVisitedBefore) {
      localStorage.setItem(FIRST_VISIT_KEY, "true");
    }
  }, []);

  const firstName = getFirstName(userName);

  if (isFirstVisit === null || !firstName) {
    return null;
  }

  return isFirstVisit
    ? `Your AI Awesomeness Starts Here, ${firstName}!`
    : `Welcome Back to AI Awesomeness, ${firstName}!`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

type HeroStatIconVariant = "published" | "people" | "usage";

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
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" strokeLinejoin="round" />
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

export function HomePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mineFilter = searchParams.get("mine") === "true";
  const showAnalytics = searchParams.get("showAnalytics") === "true";

  const [homeSearchValue, setHomeSearchValue] = useState("");
  const [isSearchParsing, setIsSearchParsing] = useState(false);

  const {
    filters,
    debouncedFilters,
    inputValue,
    setInputValue,
    setFilter,
    clearFilter,
    clearAllFilters,
    activeFilters,
    page,
    parseAndApplyNaturalLanguage,
    isParsing,
  } = useSearchState();

  const handleSearchSubmit = async () => {
    if (!homeSearchValue.trim()) return;
    
    setIsSearchParsing(true);
    try {
      const parsed = await parseNaturalLanguageQuery(homeSearchValue);
      const params = new URLSearchParams();
      
      if (parsed.searchTerms) {
        params.set("q", parsed.searchTerms);
      }
      if (parsed.tool) {
        params.set("tool", parsed.tool);
      }
      if (parsed.assetType) {
        params.set("assetType", parsed.assetType);
      }
      if (parsed.modality) {
        params.set("modality", parsed.modality);
      }
      
      navigate(`/search?${params.toString()}`);
    } catch {
      const params = new URLSearchParams({ q: homeSearchValue });
      navigate(`/search?${params.toString()}`);
    } finally {
      setIsSearchParsing(false);
    }
  };

  const pageSize = 20;

  const apiFilters = useMemo<ListAssetsFilters>(() => {
    const nextFilters: ListAssetsFilters = {
      page,
      pageSize,
      sort: debouncedFilters.sort === "mostUsed" ? "mostUsed" : "recent",
      assetType: debouncedFilters.assetType as AssetTypeFilter,
    };
    if (debouncedFilters.q.trim()) {
      nextFilters.q = debouncedFilters.q.trim();
    }
    if (debouncedFilters.tool) {
      nextFilters.tool = debouncedFilters.tool as PromptTool;
    }
    if (mineFilter) {
      nextFilters.mine = true;
    }
    if (showAnalytics) {
      nextFilters.includeAnalytics = true;
    }
    return nextFilters;
  }, [debouncedFilters, mineFilter, page, pageSize, showAnalytics]);

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    retry: false,
  });
  const canViewAnalytics = Boolean(meQuery.data && canAccessAdminUi(meQuery.data.role));
  const personalizedGreeting = usePersonalizedGreeting(meQuery.data?.name);

  const assetsQuery = useQuery({
    queryKey: ["assets", apiFilters],
    queryFn: () => listAssets(apiFilters),
  });

  const analyticsQuery = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: getAnalyticsOverview,
    enabled: canViewAnalytics,
  });

  if (assetsQuery.isLoading) {
    return <p>Loading AI assets...</p>;
  }

  if (assetsQuery.error) {
    return <p className="text-red-700">We couldn't load AI assets right now. Try refreshing.</p>;
  }

  const snapshot = assetsQuery.data?.meta.snapshot;
  const assetsPublished = snapshot?.assetsPublished ?? 0;
  const activeUsers = snapshot?.activeUsers ?? 0;
  const promptsUsed = snapshot?.promptsUsed ?? 0;
  const snapshotReady = assetsQuery.isSuccess;
  const heroStats = [
    {
      icon: "published" as const,
      label: "Assets Live",
      value: assetsPublished,
      counterActive: snapshotReady,
    },
    {
      icon: "people" as const,
      label: "Active Users",
      value: activeUsers,
      counterActive: snapshotReady,
    },
    {
      icon: "usage" as const,
      label: "Assets Used",
      value: promptsUsed,
      counterActive: snapshotReady,
    },
  ] as const;

  const featuredAssets = (assetsQuery.data?.data ?? [])
    .filter((a) => a.assetType !== "prompt" || a.thumbnailStatus !== "FAILED")
    .slice(0, 6);


  const contributorLeaderboard = (analyticsQuery.data?.contributors ?? []).slice(0, 5);
  const usersLeaderboard = (analyticsQuery.data?.userEngagementLeaderboard ?? []).slice(0, 5);

  const aiToolAudience = [
    "AI Tool users building repeatable, scalable assets",
    "Salespeople crafting personalized, account-ready outreach",
    "Developers generating code, SQL, and debugging solutions faster",
    "Marketers and content creators shipping campaigns at AI speed",
  ] as const;

  const howItWorksSteps = [
    { step: "1", title: "Discover", description: "Browse AI assets built by Salesforce experts across every role and use case." },
    { step: "2", title: "Customize", description: "Fill in variables to tailor any prompt to your specific context and audience." },
    { step: "3", title: "Launch", description: "Open directly in Slackbot, Claude, Gemini, or Cursor with one click." },
    { step: "4", title: "Scale", description: "Save your favorites, build collections, and share what works." },
  ] as const;

  return (
    <div className="space-y-7">
      {!mineFilter ? (
        <>
          <section className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-4 shadow-sm">
            <SearchBar
              inputValue={homeSearchValue}
              onInputChange={setHomeSearchValue}
              filters={{ q: "", assetType: "all", tool: "", modality: "", sort: "recent", collectionId: "", mine: false }}
              activeFilters={[]}
              onFilterChange={() => {}}
              onFilterRemove={() => {}}
              onClearAll={() => {}}
              onSubmit={handleSearchSubmit}
              isParsing={isSearchParsing}
              placeholder="Search prompts, skills, and context... (try natural language!)"
              showAssetType
            />
          </section>

          <section className="relative overflow-hidden rounded-2xl border border-(--color-border) bg-linear-to-br from-(--color-primary)/25 via-(--color-surface) to-(--color-surface-muted) p-6 shadow-sm transition-all duration-300 motion-reduce:transition-none">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-(--color-primary)/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-(--color-primary)/10 blur-3xl" />
            <div className="space-y-3">
              <p className="inline-block rounded-full border border-(--color-border) bg-(--color-surface) px-3 py-1 text-xs font-semibold tracking-[0.14em]">
                {personalizedGreeting ?? "Your AI Advantage Starts Here"}
              </p>
              <h2 className="text-3xl font-bold md:text-4xl">Find the AI assets that get results. Share the ones you've perfected.</h2>
              <p className="max-w-3xl text-(--color-text-muted)">
                Browse battle-tested AI assets from fellow Salesforce employees, customize them for your work, and launch directly into your favorite AI tool. No more starting from scratch.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Link
                  to="/prompts"
                  className="group rounded-xl border border-(--color-border) bg-(--color-surface) p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-(--color-primary)/50 hover:shadow-md motion-reduce:transform-none"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-primary)/10">
                      <svg className="h-5 w-5 text-(--color-text)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <h3 className="font-semibold">Prompts</h3>
                  </div>
                  <p className="text-sm text-(--color-text-muted)">
                    Ready-to-use instructions you give to AI tools. Fill in a few details, hit launch, and get results—no prompt engineering required.
                  </p>
                  <p className="mt-2 text-xs font-medium text-(--color-primary) group-hover:underline">Explore prompts →</p>
                </Link>
                <Link
                  to="/skills"
                  className="group rounded-xl border border-(--color-border) bg-(--color-surface) p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-(--color-primary)/50 hover:shadow-md motion-reduce:transform-none"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-primary)/10">
                      <svg className="h-5 w-5 text-(--color-text)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <h3 className="font-semibold">Skills</h3>
                  </div>
                  <p className="text-sm text-(--color-text-muted)">
                    Reusable behavior guides that teach AI how to act. Load them once, and your AI becomes a specialist—code reviewer, meeting summarizer, brand voice expert.
                  </p>
                  <p className="mt-2 text-xs font-medium text-(--color-primary) group-hover:underline">Explore skills →</p>
                </Link>
                <Link
                  to="/context"
                  className="group rounded-xl border border-(--color-border) bg-(--color-surface) p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-(--color-primary)/50 hover:shadow-md motion-reduce:transform-none"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-primary)/10">
                      <svg className="h-5 w-5 text-(--color-text)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <h3 className="font-semibold">Context</h3>
                  </div>
                  <p className="text-sm text-(--color-text-muted)">
                    Reference documents that give AI the background it needs—style guides, policies, product docs. The knowledge your AI should have before it starts working.
                  </p>
                  <p className="mt-2 text-xs font-medium text-(--color-primary) group-hover:underline">Explore context →</p>
                </Link>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <div className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) px-4 py-5 transition-all duration-300 motion-reduce:transition-none sm:px-6 sm:py-6">
                <p className="text-xs uppercase tracking-wide text-(--color-text-muted)">What's happening now</p>
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
              <span className="text-sm font-medium text-(--color-text-muted)">The AI assets people can't stop using</span>
            </div>
            {assetsQuery.data?.meta.facets && (
              <FacetedFilters
                facets={assetsQuery.data.meta.facets}
                currentFilters={filters}
                onFilterChange={setFilter}
              />
            )}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {featuredAssets.map((asset) => (
                <AssetCard
                  key={`${asset.assetType}-${asset.id}`}
                  asset={asset}
                  variant="featured"
                  highlightQuery={debouncedFilters.q}
                />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-5 shadow-sm transition-all duration-300 hover:shadow motion-reduce:transition-none">
            <h3 className="text-xl font-semibold">How AI Library Works</h3>
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
                  {getToolsSortedAlphabetically()
                    .filter((t) => t !== "other")
                    .map((toolOption) => (
                      <button
                        key={toolOption}
                        type="button"
                        onClick={() => setFilter("tool", toolOption)}
                        className="rounded-full border border-(--color-border) bg-(--color-surface) px-2 py-1 font-medium transition-colors hover:border-(--color-primary) hover:bg-(--color-primary)/10"
                      >
                        {getToolLabel(toolOption)}
                      </button>
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
                    <p className="text-sm text-(--color-text-muted)">{pluralize(contributor.promptCount, "AI asset")}</p>
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
        </>
      ) : null}

      {mineFilter ? (
        <div className="flex items-center justify-between rounded-lg border border-(--color-primary)/30 bg-(--color-primary)/5 p-4">
          <div>
            <h3 className="text-xl font-semibold">
              {showAnalytics ? "My Asset Analytics" : "My Assets"}
            </h3>
            <p className="mt-1 text-sm text-(--color-text-muted)">
              {showAnalytics
                ? "View performance metrics for all assets you've created"
                : "View and manage prompts, skills, and context you've created"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm hover:bg-(--color-surface-muted)"
          >
            Show All Assets
          </button>
        </div>
      ) : null}
    </div>
  );
}
