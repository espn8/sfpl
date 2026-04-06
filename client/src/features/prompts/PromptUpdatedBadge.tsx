import { shouldShowRecentlyUpdatedBadge } from "./recentPromptUpdate";

type PromptUpdatedBadgeProps = {
  createdAt: string;
  updatedAt: string;
  className?: string;
};

export function PromptUpdatedBadge({ createdAt, updatedAt, className = "" }: PromptUpdatedBadgeProps) {
  if (!shouldShowRecentlyUpdatedBadge(createdAt, updatedAt)) {
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
