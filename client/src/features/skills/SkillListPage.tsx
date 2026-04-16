import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listSkills } from "./api";

export function SkillListPage() {
  const [searchParams] = useSearchParams();
  const mineFilter = searchParams.get("mine") === "true";
  const showAnalytics = searchParams.get("showAnalytics") === "true";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filters = useMemo(
    () => ({
      q: search.trim() || undefined,
      mine: mineFilter || undefined,
      includeAnalytics: showAnalytics || undefined,
      page,
      pageSize,
    }),
    [search, mineFilter, showAnalytics, page, pageSize],
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

      <div className="rounded-lg border border-(--color-border) bg-(--color-surface) p-4">
        <label className="block text-sm font-medium text-(--color-text-muted)" htmlFor="skill-search">
          Search
        </label>
        <input
          id="skill-search"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Title or body…"
          className="mt-1 w-full max-w-md rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        />
      </div>

      {query.isLoading ? <p className="text-sm text-(--color-text-muted)">Just a moment...</p> : null}
      {query.isError ? (
        <p className="text-sm text-red-600" role="alert">
          We couldn't load skills right now. Try refreshing.
        </p>
      ) : null}

      {query.data ? (
        <>
          <ul className="space-y-3">
            {query.data.data.map((skill) => (
              <li key={skill.id}>
                <Link
                  to={`/skills/${skill.id}`}
                  className="block rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-4 transition hover:border-(--color-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold">{skill.title}</h2>
                      {skill.summary ? <p className="mt-1 text-sm text-(--color-text-muted)">{skill.summary}</p> : null}
                    </div>
                    <span className="shrink-0 rounded-full border border-(--color-border) px-2 py-0.5 text-xs font-medium uppercase">
                      {skill.status}
                    </span>
                  </div>
                  {showAnalytics ? (
                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-(--color-primary)/20 bg-(--color-primary)/5 p-3">
                      <div className="text-center">
                        <p className="text-lg font-bold text-(--color-text)">{(skill.viewCount ?? 0).toLocaleString()}</p>
                        <p className="text-xs text-(--color-text-muted)">Views</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-(--color-text)">{(skill.copyCount ?? 0).toLocaleString()}</p>
                        <p className="text-xs text-(--color-text-muted)">Copies</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-(--color-text)">{(skill.favoriteCount ?? 0).toLocaleString()}</p>
                        <p className="text-xs text-(--color-text-muted)">Favorites</p>
                      </div>
                    </div>
                  ) : null}
                  <p className="mt-2 text-xs text-(--color-text-muted)">
                    Updated {new Date(skill.updatedAt).toLocaleString()} · {skill.owner.name ?? "Member"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {query.data.data.length === 0 ? <p className="text-sm text-(--color-text-muted)">No skills yet. Be the first to share one.</p> : null}
          {query.data.meta.totalPages > 1 ? (
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                className="rounded border border-(--color-border) px-3 py-1 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span>
                Page {page} of {query.data.meta.totalPages}
              </span>
              <button
                type="button"
                className="rounded border border-(--color-border) px-3 py-1 disabled:opacity-40"
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
