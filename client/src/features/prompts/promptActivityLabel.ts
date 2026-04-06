const MIN_DELTA_AFTER_CREATE_MS = 2_000;

/** Human-readable label for when a prompt was added or last meaningfully updated. */
export function formatPromptActivityLabel(createdAt: string, updatedAt: string, nowMs: number = Date.now()): string {
  const created = Date.parse(createdAt);
  const updated = Date.parse(updatedAt);
  if (Number.isNaN(created) || Number.isNaN(updated)) {
    return "";
  }
  const edited = updated - created >= MIN_DELTA_AFTER_CREATE_MS;
  const refMs = edited ? updated : created;
  const ref = new Date(refMs);
  const now = new Date(nowMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfRefDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfRefDay) / 86_400_000);
  if (diffDays === 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays > 1 && diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return ref.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: ref.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}
