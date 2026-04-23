const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
const MIN_DELTA_AFTER_CREATE_MS = 2_000;

export function shouldShowUpdatedBadge(createdAt: string, updatedAt: string, nowMs: number = Date.now()): boolean {
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

type UpdatedBadgeProps = {
  createdAt: string;
  updatedAt: string;
  className?: string;
};

export function UpdatedBadge({ createdAt, updatedAt, className = "" }: UpdatedBadgeProps) {
  if (!shouldShowUpdatedBadge(createdAt, updatedAt)) {
    return null;
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border border-(--color-primary)/35 bg-(--color-primary)/10 px-2 py-0.5 text-xs font-medium text-(--color-primary) ${className}`.trim()}
      title="Edited in the last 72 hours"
    >
      Updated
    </span>
  );
}
