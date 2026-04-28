import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { fetchMe } from "../auth/api";
import { canAccessAdminUi, canCreateContent } from "../auth/roles";
import { getAnalyticsOverview } from "../analytics/api";
import { listAssets, type ListAssetsFilters } from "../assets/api";
import { AssetCard } from "../assets/AssetCard";
import { AssetAnalyticsTable } from "../assets/AssetAnalyticsTable";
import { AssetListView } from "../assets/AssetListView";
import { getToolLabel, getToolsSortedAlphabetically, type PromptTool } from "../prompts/api";
import {
  DEFAULT_FILTERS,
  SearchBar,
  filtersToParams,
  getActiveFilters,
  useSearchState,
  type AssetTypeFilter,
  type SearchFilters,
} from "../search";
import { parseNaturalLanguageQuery } from "../search/api";
import { useHomePerfMarks } from "./useHomePerfMarks";

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

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const HOW_IT_WORKS_IO: IntersectionObserverInit = {
  threshold: 0.14,
  rootMargin: "0px 0px -8% 0px",
};

function useRevealWhenInView<E extends HTMLElement>(): { ref: RefObject<E | null>; revealed: boolean } {
  const ref = useRef<E | null>(null);
  const [revealed, setRevealed] = useState(prefersReducedMotion);

  useEffect(() => {
    if (revealed) return;
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setRevealed(true);
      }
    }, HOW_IT_WORKS_IO);
    ob.observe(el);
    return () => ob.disconnect();
  }, [revealed]);

  return { ref, revealed };
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
  const durationMs = 1300;

  useEffect(() => {
    if (!active) {
      setDisplay(0);
      return;
    }

    if (prefersReducedMotion()) {
      setDisplay(end);
      return;
    }

    setDisplay(0);
    let frameId = 0;
    const startAfter = window.setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = 1 - (1 - t) ** 4;
        const next = t >= 1 ? end : Math.round(end * eased);
        setDisplay(next);
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

  const progress = end <= 0 ? 1 : Math.min(1, display / end);
  const motionStyle: CSSProperties | undefined = prefersReducedMotion()
    ? undefined
    : {
        opacity: 0.78 + 0.22 * progress,
        transform: `translateY(${(1 - progress) * 2.5}px)`,
      };

  return (
    <span
      className="inline-block text-3xl font-bold tabular-nums tracking-tight motion-safe:transition-[opacity,transform] motion-safe:duration-150 motion-safe:ease-out motion-reduce:transition-none md:text-4xl"
      style={motionStyle}
    >
      {display.toLocaleString()}
    </span>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mineFilter = searchParams.get("mine") === "true";
  const showAnalytics = searchParams.get("showAnalytics") === "true";

  const [homeSearchValue, setHomeSearchValue] = useState("");
  const [isSearchParsing, setIsSearchParsing] = useState(false);
  const [homeBrowseFilters, setHomeBrowseFilters] = useState<SearchFilters>(() => ({ ...DEFAULT_FILTERS }));
  const homeBrowseFiltersRef = useRef(homeBrowseFilters);
  const homeSearchInputRef = useRef(homeSearchValue);
  const navigateToSearchTimerRef = useRef<number | null>(null);

  homeBrowseFiltersRef.current = homeBrowseFilters;
  homeSearchInputRef.current = homeSearchValue;

  const scheduleNavigateToSearch = useCallback(() => {
    if (navigateToSearchTimerRef.current !== null) {
      clearTimeout(navigateToSearchTimerRef.current);
    }
    navigateToSearchTimerRef.current = window.setTimeout(() => {
      navigateToSearchTimerRef.current = null;
      const params = filtersToParams({
        ...homeBrowseFiltersRef.current,
        q: homeSearchInputRef.current.trim(),
      });
      const qs = params.toString();
      navigate(qs ? `/search?${qs}` : "/search");
    }, 0);
  }, [navigate]);

  useEffect(
    () => () => {
      if (navigateToSearchTimerRef.current !== null) {
        clearTimeout(navigateToSearchTimerRef.current);
      }
    },
    [],
  );

  const handleHomeSearchInputChange = useCallback((value: string) => {
    homeSearchInputRef.current = value;
    setHomeSearchValue(value);
  }, []);

  const handleHomeSearchBarFilterChange = useCallback(
    <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
      const next = { ...homeBrowseFiltersRef.current, [key]: value };
      homeBrowseFiltersRef.current = next;
      setHomeBrowseFilters(next);
      scheduleNavigateToSearch();
    },
    [scheduleNavigateToSearch],
  );

  const handleHomeSearchBarFilterRemove = useCallback(
    (key: keyof SearchFilters) => {
      const next = { ...homeBrowseFiltersRef.current, [key]: DEFAULT_FILTERS[key] };
      homeBrowseFiltersRef.current = next;
      setHomeBrowseFilters(next);
      if (key === "q") {
        homeSearchInputRef.current = "";
        setHomeSearchValue("");
      }
      scheduleNavigateToSearch();
    },
    [scheduleNavigateToSearch],
  );

  const handleHomeSearchBarClearAll = useCallback(() => {
    homeBrowseFiltersRef.current = { ...DEFAULT_FILTERS };
    homeSearchInputRef.current = "";
    setHomeBrowseFilters({ ...DEFAULT_FILTERS });
    setHomeSearchValue("");
    navigate("/search");
  }, [navigate]);

  const homeSearchActiveFilters = useMemo(() => getActiveFilters(homeBrowseFilters), [homeBrowseFilters]);

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
    setPage,
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
    const sortMap: Record<string, ListAssetsFilters["sort"]> = {
      mostUsed: "mostUsed",
      name: "name",
      updatedAt: "updatedAt",
      recent: "recent",
    };
    const nextFilters: ListAssetsFilters = {
      page,
      pageSize,
      sort: sortMap[debouncedFilters.sort] ?? "recent",
      assetType: debouncedFilters.assetType as AssetTypeFilter,
    };
    if (debouncedFilters.q.trim()) {
      nextFilters.q = debouncedFilters.q.trim();
    }
    if (debouncedFilters.tool) {
      nextFilters.tool = debouncedFilters.tool as PromptTool;
    }
    if (debouncedFilters.status) {
      nextFilters.status = debouncedFilters.status;
    }
    if (debouncedFilters.tag.trim()) {
      nextFilters.tag = debouncedFilters.tag.trim();
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

  const topPerformersQuery = useQuery({
    queryKey: ["assets", "topPerformers"],
    queryFn: () =>
      listAssets({
        assetType: "all",
        sort: "mostUsed",
        pageSize: 12,
        page: 1,
        // The primary /api/assets call above already delivers meta.snapshot
        // for the hero stats. The top-performers call doesn't use snapshot
        // anywhere in the UI, so skip the 6 team-wide count queries on the
        // server (saves ~200-400ms on the homepage critical path).
        snapshot: false,
      }),
    enabled: !mineFilter,
  });

  const [showAllTopPerformers, setShowAllTopPerformers] = useState(false);

  const analyticsQuery = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: getAnalyticsOverview,
    enabled: canViewAnalytics,
  });

  const topPerformers = useMemo(() => {
    const allAssets = topPerformersQuery.data?.data ?? [];
    return allAssets.filter(
      (a) => a.assetType !== "prompt" || a.thumbnailStatus !== "FAILED"
    );
  }, [topPerformersQuery.data]);

  useHomePerfMarks({
    meReady: meQuery.isSuccess || meQuery.isError,
    assetsReady: assetsQuery.isSuccess || assetsQuery.isError,
    topReady: topPerformersQuery.fetchStatus === "idle",
    analyticsReady: analyticsQuery.fetchStatus === "idle",
    analyticsEnabled: canViewAnalytics,
  });

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

  const visibleTopPerformers = showAllTopPerformers
    ? topPerformers
    : topPerformers.slice(0, 6);


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

  const howItWorksReveal = useRevealWhenInView<HTMLElement>();

  return (
    <div className="space-y-7">
      {!mineFilter ? (
        <>
          <section className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-4 shadow-sm">
            <SearchBar
              inputValue={homeSearchValue}
              onInputChange={handleHomeSearchInputChange}
              filters={homeBrowseFilters}
              activeFilters={homeSearchActiveFilters}
              onFilterChange={handleHomeSearchBarFilterChange}
              onFilterRemove={handleHomeSearchBarFilterRemove}
              onClearAll={handleHomeSearchBarClearAll}
              onSubmit={handleSearchSubmit}
              isParsing={isSearchParsing}
              placeholder="Search prompts, skills, context and builds... (try natural language!)"
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

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                <Link
                  to="/builds"
                  className="group rounded-xl border border-(--color-border) bg-(--color-surface) p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-(--color-primary)/50 hover:shadow-md motion-reduce:transform-none"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-primary)/10">
                      <svg className="h-5 w-5 text-(--color-text)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="12" y1="22.08" x2="12" y2="12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <h3 className="font-semibold">Builds</h3>
                  </div>
                  <p className="text-sm text-(--color-text-muted)">
                    Reusable AI tools, apps, and solutions built by the team. Open a finished build, try it out, and put it to work—no setup required.
                  </p>
                  <p className="mt-2 text-xs font-medium text-(--color-primary) group-hover:underline">Explore builds →</p>
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
              <h3 className="text-xl font-semibold">Top Assets This Week</h3>
              <span className="text-sm font-medium text-(--color-text-muted)">The AI assets people can't stop using</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {topPerformersQuery.isLoading && visibleTopPerformers.length === 0
                ? Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={`top-performer-skeleton-${index}`}
                      data-testid="top-performer-skeleton"
                      aria-hidden
                      className="h-56 animate-pulse rounded-2xl border border-(--color-border) bg-(--color-surface-muted)"
                    />
                  ))
                : visibleTopPerformers.map((asset) => (
                    <AssetCard
                      key={`${asset.assetType}-${asset.id}`}
                      asset={asset}
                      variant="featured"
                      highlightQuery={debouncedFilters.q}
                    />
                  ))}
            </div>
            {topPerformersQuery.isError && visibleTopPerformers.length === 0 ? (
              <p className="text-sm text-(--color-text-muted)">
                We couldn't load top performers right now. Try refreshing.
              </p>
            ) : null}
            {topPerformers.length > 6 && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowAllTopPerformers(!showAllTopPerformers)}
                  className="flex items-center gap-1.5 rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-2 text-sm font-medium transition-colors hover:bg-(--color-surface-muted)"
                >
                  {showAllTopPerformers ? (
                    <>
                      Show less
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="m18 15-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </>
                  ) : (
                    <>
                      Show {topPerformers.length - 6} more
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            )}
          </section>

          <section
            ref={howItWorksReveal.ref}
            data-revealed={howItWorksReveal.revealed ? "" : undefined}
            className="home-how-it-works-section rounded-2xl border border-(--color-border) bg-(--color-surface) p-5 shadow-sm transition-all duration-300 hover:shadow motion-reduce:transition-none"
          >
            <h3 className="home-how-it-works-title text-xl font-semibold">How AI Library Works</h3>
            <ol className="mt-6 flex list-none flex-col gap-0 p-0 md:mt-8 md:flex-row md:items-stretch">
              {howItWorksSteps.map((item, index) => {
                const isFirst = index === 0;
                const isLast = index === howItWorksSteps.length - 1;
                return (
                  <li key={item.step} className="home-how-it-works-step flex flex-1 flex-col md:min-w-0">
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
                        onClick={() => {
                          const next = { ...homeBrowseFiltersRef.current, tool: toolOption };
                          navigate(`/search?${filtersToParams(next).toString()}`);
                        }}
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
              <h3 className="text-xl font-semibold">Top Contributors This Week</h3>
              <p className="mt-1 text-sm text-(--color-text-muted)">
                Published assets first added in the last 7 days
              </p>
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
                    <p className="text-sm text-(--color-text-muted)">{pluralize(contributor.assetCount, "AI asset")}</p>
                  </div>
                ))}
                {contributorLeaderboard.length === 0 ? (
                  <p className="text-sm text-(--color-text-muted)">No new published assets in the last 7 days.</p>
                ) : null}
              </div>
            </div>
            <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-5 shadow-sm transition-all duration-300 hover:shadow motion-reduce:transition-none">
              <h3 className="text-xl font-semibold">Most Active This Week</h3>
              <p className="mt-1 text-sm text-(--color-text-muted)">Uses, favorites, and ratings in the last 7 days</p>
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
                    <p className="text-sm text-(--color-text-muted)">Score {user.score}</p>
                  </div>
                ))}
                {usersLeaderboard.length === 0 ? (
                  <p className="text-sm text-(--color-text-muted)">No engagement on your catalog in the last 7 days.</p>
                ) : null}
              </div>
            </div>
          </section>
          ) : null}
        </>
      ) : null}

      {mineFilter ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-(--color-primary)/30 bg-(--color-primary)/5 p-4">
            <div>
              <h3 className="text-xl font-semibold">
                {showAnalytics ? "My Asset Analytics" : "My Content"}
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
              Browse All Assets
            </button>
          </div>

          <section className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-4 shadow-sm">
            <SearchBar
              inputValue={inputValue}
              onInputChange={setInputValue}
              filters={filters}
              activeFilters={activeFilters}
              onFilterChange={setFilter}
              onFilterRemove={clearFilter}
              onClearAll={clearAllFilters}
              placeholder="Search your content by name..."
              showAssetType
              showStatus
              showSort
              showSuggestions={false}
            />
          </section>

          {assetsQuery.isLoading && !assetsQuery.data ? (
            <section className="space-y-3" data-testid="mine-assets-skeleton">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`mine-skeleton-${index}`}
                  aria-hidden
                  className="h-20 animate-pulse rounded-xl border border-(--color-border) bg-(--color-surface-muted)"
                />
              ))}
            </section>
          ) : assetsQuery.isError && !assetsQuery.data ? (
            <section className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-8 text-center">
              <p className="text-red-700">We couldn't load your assets right now. Try refreshing.</p>
            </section>
          ) : assetsQuery.data?.data && assetsQuery.data.data.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-(--color-text-muted)">
                  {assetsQuery.data.meta.total} {assetsQuery.data.meta.total === 1 ? "asset" : "assets"} found
                </p>
              </div>
              {showAnalytics ? (
                <AssetAnalyticsTable assets={assetsQuery.data.data} />
              ) : (
                <AssetListView assets={assetsQuery.data.data} />
              )}
              {assetsQuery.data.meta.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm hover:bg-(--color-surface-muted) disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-(--color-text-muted)">
                    Page {page} of {assetsQuery.data.meta.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page === assetsQuery.data.meta.totalPages}
                    onClick={() => setPage(page + 1)}
                    className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm hover:bg-(--color-surface-muted) disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-8 text-center">
              <p className="text-(--color-text-muted)">
                {debouncedFilters.q || debouncedFilters.assetType !== "all" || debouncedFilters.status
                  ? "No assets match your filters. Try adjusting your search."
                  : "You haven't created any assets yet. Start by creating a prompt, skill, or context document!"}
              </p>
              {!debouncedFilters.q && debouncedFilters.assetType === "all" && !debouncedFilters.status && canCreateContent(meQuery.data?.role) && (
                <div className="mt-4 flex justify-center gap-3">
                  <Link
                    to="/prompts/new"
                    className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-medium text-(--color-text-inverse) hover:bg-(--color-primary-active)"
                  >
                    Create Prompt
                  </Link>
                  <Link
                    to="/skills/new"
                    className="rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-2 text-sm font-medium hover:bg-(--color-surface-muted)"
                  >
                    Create Skill
                  </Link>
                  <Link
                    to="/context/new"
                    className="rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-2 text-sm font-medium hover:bg-(--color-surface-muted)"
                  >
                    Create Context
                  </Link>
                </div>
              )}
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}
