const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
/** Treat as a real edit only if `updatedAt` is meaningfully after `createdAt` (avoids "Updated" on brand-new rows). */
const MIN_DELTA_AFTER_CREATE_MS = 2_000;

export function shouldShowRecentlyUpdatedBadge(
  createdAt: string,
  updatedAt: string,
  nowMs: number = Date.now(),
): boolean {
  const updated = Date.parse(updatedAt);
  const created = Date.parse(createdAt);
  if (Number.isNaN(updated) || Number.isNaN(created)) {
    return false;
  }
  if (nowMs - updated > SEVENTY_TWO_HOURS_MS) {
    return false;
  }
  return updated - created >= MIN_DELTA_AFTER_CREATE_MS;
}
