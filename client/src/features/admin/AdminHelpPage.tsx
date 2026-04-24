import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminHelpContent,
  type AdminHelpArticle,
  type AdminHelpSection,
} from "./adminHelpContent";

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-(--color-text-muted) transition-transform ${
        expanded ? "rotate-90" : ""
      }`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

type ArticleProps = {
  article: AdminHelpArticle;
  forceExpanded: boolean;
};

function Article({ article, forceExpanded }: ArticleProps) {
  const [expandedLocal, setExpandedLocal] = useState(false);
  const expanded = forceExpanded || expandedLocal;

  return (
    <div className="border-b border-(--color-border) last:border-b-0">
      <button
        type="button"
        onClick={() => setExpandedLocal((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-(--color-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-inset"
      >
        <span className="font-medium">{article.question}</span>
        <ChevronIcon expanded={expanded} />
      </button>
      {expanded ? (
        <div className="px-4 pb-4 text-sm text-(--color-text-muted) whitespace-pre-line">
          {article.answer}
        </div>
      ) : null}
    </div>
  );
}

type SectionProps = {
  section: AdminHelpSection;
  forceExpanded: boolean;
};

function Section({ section, forceExpanded }: SectionProps) {
  return (
    <section
      id={section.id}
      className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-hidden"
    >
      <h2 className="border-b border-(--color-border) bg-(--color-surface-muted) px-4 py-3 text-lg font-semibold">
        {section.title}
      </h2>
      <div>
        {section.articles.map((article, index) => (
          <Article
            key={index}
            article={article}
            forceExpanded={forceExpanded}
          />
        ))}
      </div>
    </section>
  );
}

export function AdminHelpPage() {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return adminHelpContent;
    return adminHelpContent
      .map((section) => ({
        ...section,
        articles: section.articles.filter(
          (article) =>
            article.question.toLowerCase().includes(query) ||
            article.answer.toLowerCase().includes(query),
        ),
      }))
      .filter((section) => section.articles.length > 0);
  }, [filter]);

  const forceExpanded = filter.trim().length > 0;
  const hasResults = filtered.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin Help</h1>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            Documentation for admin-only workflows — governance, ownership
            transfer, analytics interpretation, system collections, and
            tool-request review.
          </p>
        </div>
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-2 text-sm font-medium hover:bg-(--color-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
        >
          ← Admin Dashboard
        </Link>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="lg:sticky lg:top-8 lg:w-56 shrink-0">
          <nav className="rounded-xl border border-(--color-border) bg-(--color-surface) p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">
              Topics
            </p>
            <ul className="space-y-1">
              {adminHelpContent.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block rounded-lg px-3 py-1.5 text-sm hover:bg-(--color-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="flex-1 space-y-6">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-(--color-text-muted)" />
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter admin help..."
              className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) py-3 pl-10 pr-4 focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20"
            />
          </div>

          {hasResults ? (
            filtered.map((section) => (
              <Section
                key={section.id}
                section={section}
                forceExpanded={forceExpanded}
              />
            ))
          ) : (
            <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-8 text-center">
              <p className="text-(--color-text-muted)">
                No admin help articles match "{filter}".
              </p>
              <button
                type="button"
                className="mt-3 text-sm text-(--color-primary) hover:underline"
                onClick={() => setFilter("")}
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
