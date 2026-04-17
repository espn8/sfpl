import type { ReactNode } from "react";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightMatches(text: string, query: string): ReactNode {
  if (!text) return text;
  if (!query || !query.trim()) return text;

  const trimmedQuery = query.trim();

  const words = trimmedQuery
    .split(/\s+/)
    .filter((word) => word.length >= 2)
    .map(escapeRegex);

  if (words.length === 0) return text;

  const pattern = words.join("|");
  const regex = new RegExp(`(${pattern})`, "gi");

  const parts = text.split(regex);

  if (parts.length === 1) return text;

  return (
    <>
      {parts.map((part, index) => {
        if (regex.test(part)) {
          return (
            <mark
              key={index}
              className="rounded-sm bg-yellow-200/70 px-0.5 text-inherit dark:bg-yellow-500/30"
            >
              {part}
            </mark>
          );
        }
        return part;
      })}
    </>
  );
}

export function truncateWithHighlight(
  text: string,
  query: string,
  maxLength: number = 150
): ReactNode {
  if (!text) return text;
  if (!query || !query.trim()) {
    return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
  }

  const trimmedQuery = query.trim().toLowerCase();
  const words = trimmedQuery.split(/\s+/).filter((word) => word.length >= 2);

  if (words.length === 0) {
    return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
  }

  const lowerText = text.toLowerCase();
  let firstMatchIndex = -1;

  for (const word of words) {
    const idx = lowerText.indexOf(word);
    if (idx !== -1 && (firstMatchIndex === -1 || idx < firstMatchIndex)) {
      firstMatchIndex = idx;
    }
  }

  if (firstMatchIndex === -1) {
    return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
  }

  const contextPadding = Math.floor(maxLength / 3);
  const start = Math.max(0, firstMatchIndex - contextPadding);
  const end = Math.min(text.length, start + maxLength);

  let excerpt = text.slice(start, end);
  if (start > 0) excerpt = `...${excerpt}`;
  if (end < text.length) excerpt = `${excerpt}...`;

  return highlightMatches(excerpt, query);
}
