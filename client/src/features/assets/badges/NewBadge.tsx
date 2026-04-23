const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
const MIN_DELTA_AFTER_CREATE_MS = 2_000;

export function shouldShowNewBadge(createdAt: string, updatedAt: string, nowMs: number = Date.now()): boolean {
  const created = Date.parse(createdAt);
  const updated = Date.parse(updatedAt);
  if (Number.isNaN(created) || Number.isNaN(updated)) {
    return false;
  }
  if (nowMs - created > SEVENTY_TWO_HOURS_MS) {
    return false;
  }
  return updated - created < MIN_DELTA_AFTER_CREATE_MS;
}

type NewBadgeProps = {
  createdAt: string;
  updatedAt: string;
  className?: string;
};

export function NewBadge({ createdAt, updatedAt, className = "" }: NewBadgeProps) {
  if (!shouldShowNewBadge(createdAt, updatedAt)) {
    return null;
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 ${className}`.trim()}
      title="Added in the last 72 hours"
    >
      New
    </span>
  );
}
