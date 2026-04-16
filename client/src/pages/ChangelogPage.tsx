import { changelog } from "../data/changelog";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ChangelogPage() {
  const currentVersion = import.meta.env.VITE_APP_VERSION || "0.0.0";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Changelog</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Current version: <span className="font-semibold">v{currentVersion}</span>
        </p>
      </div>

      <div className="space-y-6">
        {changelog.map((entry, index) => (
          <article
            key={entry.version}
            className="rounded-xl border border-(--color-border) bg-(--color-surface) p-5"
          >
            <header className="mb-3 flex flex-wrap items-baseline gap-3">
              <h2 className="text-lg font-semibold">
                v{entry.version}
                {index === 0 && (
                  <span className="ml-2 rounded-full bg-(--color-primary)/10 px-2 py-0.5 text-xs font-medium text-(--color-primary)">
                    Latest
                  </span>
                )}
              </h2>
              <time className="text-sm text-(--color-text-muted)" dateTime={entry.date}>
                {formatDate(entry.date)}
              </time>
            </header>
            <ul className="space-y-2">
              {entry.changes.map((change, changeIndex) => (
                <li key={changeIndex} className="flex gap-2 text-(--color-text)">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-text-muted)" />
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
