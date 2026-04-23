import { SmartPickBadge } from "./SmartPickBadge";
import { PopularBadge } from "./PopularBadge";
import { NewBadge } from "./NewBadge";
import { UpdatedBadge } from "./UpdatedBadge";

type AssetBadgesProps = {
  createdAt: string;
  updatedAt: string;
  isSmartPick?: boolean;
  favoriteCount?: number;
  className?: string;
};

export function AssetBadges({
  createdAt,
  updatedAt,
  isSmartPick,
  favoriteCount,
  className = "",
}: AssetBadgesProps) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 ${className}`.trim()}>
      <SmartPickBadge isSmartPick={isSmartPick} />
      <PopularBadge favoriteCount={favoriteCount} />
      <NewBadge createdAt={createdAt} updatedAt={updatedAt} />
      <UpdatedBadge createdAt={createdAt} updatedAt={updatedAt} />
    </span>
  );
}
