import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listContext } from "./api";

export function ContextListPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filters = useMemo(
    () => ({
      q: search.trim() || undefined,
      page,
      pageSize,
    }),
    [search, page, pageSize],
  );

  const query = useQuery({
    queryKey: ["context", filters],
    queryFn: () => listContext(filters),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Context</h1>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            Markdown references and rules (treat as <code className="rounded bg-(--color-surface-muted) px-1">.md</code>).
          </p>
        </div>
        <Link
          to="/context/new"
          className="inline-flex items-center justify-center rounded-full bg-linear-to-r from-indigo-500 via-fuchsia-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400"
        >
          New context file
        </Link>
      </div>

      <div className="rounded-lg border border-(--color-border) bg-(--color-surface) p-4">
        <label className="block text-sm font-medium text-(--color-text-muted)" htmlFor="context-search">
          Search
        </label>
        <input
          id="context-search"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Title or body…"
          className="mt-1 w-full max-w-md rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        />
      </div>

      {query.isLoading ? <p className="text-sm text-(--color-text-muted)">Loading…</p> : null}
      {query.isError ? (
        <p className="text-sm text-red-600" role="alert">
          Could not load context documents.
        </p>
      ) : null}

      {query.data ? (
        <>
          <ul className="space-y-3">
            {query.data.data.map((doc) => (
              <li key={doc.id}>
                <Link
                  to={`/context/${doc.id}`}
                  className="block rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-4 transition hover:border-(--color-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold">{doc.title}</h2>
                      {doc.summary ? <p className="mt-1 text-sm text-(--color-text-muted)">{doc.summary}</p> : null}
                    </div>
                    <span className="shrink-0 rounded-full border border-(--color-border) px-2 py-0.5 text-xs font-medium uppercase">
                      {doc.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-(--color-text-muted)">
                    Updated {new Date(doc.updatedAt).toLocaleString()} · {doc.owner.name ?? "Member"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {query.data.data.length === 0 ? <p className="text-sm text-(--color-text-muted)">No context files yet.</p> : null}
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
