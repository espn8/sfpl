import { TrophyIcon } from "./icons";

const POPULAR_THRESHOLD = 25;

type PopularBadgeProps = {
  favoriteCount?: number;
  className?: string;
};

export function PopularBadge({ favoriteCount, className = "" }: PopularBadgeProps) {
  if (!favoriteCount || favoriteCount < POPULAR_THRESHOLD) {
    return null;
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center text-amber-500 dark:text-amber-400 ${className}`.trim()}
      title={`Popular - ${favoriteCount} favorites`}
    >
      <TrophyIcon className="h-4 w-4" />
    </span>
  );
}
