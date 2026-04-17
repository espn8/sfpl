import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listSkills, getSkillToolLabel, getSkillToolsSortedAlphabetically, type ListSkillsFilters } from "./api";
import { SkillListCard } from "./SkillListCard";

export function SkillListPage() {
  const [searchParams] = useSearchParams();
  const mineFilter = searchParams.get("mine") === "true";
  const showAnalytics = searchParams.get("showAnalytics") === "true";
  const [search, setSearch] = useState("");
  const [tool, setTool] = useState(() => searchParams.get("tool") ?? "");
  const [sort, setSort] = useState<"recent" | "mostUsed">("recent");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filters = useMemo<ListSkillsFilters>(
    () => ({
      q: search.trim() || undefined,
      tool: tool || undefined,
      sort,
      mine: mineFilter || undefined,
      includeAnalytics: showAnalytics || undefined,
      page,
      pageSize,
    }),
    [search, tool, sort, mineFilter, showAnalytics, page, pageSize],
  );

  const query = useQuery({
    queryKey: ["skills", filters],
    queryFn: () => listSkills(filters),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {showAnalytics ? "My Skill Analytics" : mineFilter ? "Your Skills" : "Skills"}
          </h1>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            {showAnalytics
              ? "See how your skills are performing with views, copies, and favorites."
              : mineFilter
                ? "Skills you've created. Edit or manage your contributions."
                : "Reusable AI skill definitions you can load into your tools. Think of them as instruction manuals your AI can follow."}
          </p>
        </div>
        <Link
          to="/skills/new"
          className="inline-flex items-center justify-center rounded-full bg-linear-to-r from-indigo-500 via-fuchsia-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
        >
          Create Skill
        </Link>
      </div>

      <div className="grid gap-2 rounded border border-(--color-border) bg-(--color-surface) p-3 md:grid-cols-2 lg:grid-cols-3">
        <input
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search skills by keyword, use case, or author..."
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        />
        <select
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as "recent" | "mostUsed");
            setPage(1);
          }}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="recent">Sort: Most recent</option>
          <option value="mostUsed">Sort: Most used</option>
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
          {getSkillToolsSortedAlphabetically().map((option) => (
            <option key={option} value={option}>
              {getSkillToolLabel(option)}
            </option>
          ))}
        </select>
      </div>

      {query.isLoading ? <p className="text-sm text-(--color-text-muted)">Just a moment...</p> : null}
      {query.isError ? (
        <p className="text-sm text-red-600" role="alert">
          We couldn't load skills right now. Try refreshing.
        </p>
      ) : null}

      {query.data ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {query.data.data.map((skill) => (
              <SkillListCard key={skill.id} skill={skill} showAnalytics={showAnalytics} />
            ))}
          </div>
          {query.data.data.length === 0 ? <p className="text-sm text-(--color-text-muted)">No skills yet. Be the first to share one.</p> : null}
          {query.data.meta.totalPages > 1 ? (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1.5 disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="text-sm text-(--color-text-muted)">
                Page {page} of {query.data.meta.totalPages}
              </span>
              <button
                type="button"
                className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1.5 disabled:opacity-50"
                disabled={page >= query.data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
