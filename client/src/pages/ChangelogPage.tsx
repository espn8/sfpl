import { useMemo, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { changelog, type ChangelogEntry } from "../data/changelog";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type DateGroup = {
  date: string;
  entries: ChangelogEntry[];
};

function groupByDate(entries: ChangelogEntry[]): DateGroup[] {
  const groups = new Map<string, ChangelogEntry[]>();

  for (const entry of entries) {
    const existing = groups.get(entry.date);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(entry.date, [entry]);
    }
  }

  return Array.from(groups.entries()).map(([date, entries]) => ({
    date,
    entries,
  }));
}

export function ChangelogPage() {
  const currentVersion = import.meta.env.VITE_APP_VERSION || "0.0.0";
  const groupedChangelog = useMemo(() => groupByDate(changelog), []);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

  const toggleDate = (date: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const latestVersion = changelog[0]?.version;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Changelog</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Current version: <span className="font-semibold">v{currentVersion}</span>
        </p>
      </div>

      <div className="space-y-4">
        {groupedChangelog.map((group) => {
          const isCollapsed = collapsedDates.has(group.date);
          const totalChanges = group.entries.reduce(
            (sum, entry) => sum + entry.changes.length,
            0
          );

          return (
            <div
              key={group.date}
              className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleDate(group.date)}
                className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-(--color-surface-hover) transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isCollapsed ? (
                    <ChevronRightIcon className="h-5 w-5 text-(--color-text-muted)" />
                  ) : (
                    <ChevronDownIcon className="h-5 w-5 text-(--color-text-muted)" />
                  )}
                  <time
                    className="text-base font-semibold"
                    dateTime={group.date}
                  >
                    {formatDate(group.date)}
                  </time>
                </div>
                <div className="flex items-center gap-2 text-sm text-(--color-text-muted)">
                  <span>
                    {group.entries.length} release{group.entries.length !== 1 && "s"}
                  </span>
                  <span className="text-(--color-border)">•</span>
                  <span>
                    {totalChanges} change{totalChanges !== 1 && "s"}
                  </span>
                </div>
              </button>

              {!isCollapsed && (
                <div className="border-t border-(--color-border) px-5 py-4 space-y-4">
                  {group.entries.map((entry) => (
                    <article key={entry.version}>
                      <header className="mb-2 flex flex-wrap items-baseline gap-2">
                        <h2 className="text-lg font-semibold">
                          v{entry.version}
                          {entry.version === latestVersion && (
                            <span className="ml-2 rounded-full bg-(--color-primary)/10 px-2 py-0.5 text-xs font-medium text-(--color-primary)">
                              Latest
                            </span>
                          )}
                        </h2>
                      </header>
                      <ul className="space-y-2 pl-1">
                        {entry.changes.map((change, changeIndex) => (
                          <li
                            key={changeIndex}
                            className="flex gap-2 text-(--color-text)"
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-text-muted)" />
                            <span>{change}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
