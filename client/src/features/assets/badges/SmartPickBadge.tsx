import { BrainIcon } from "./icons";

type SmartPickBadgeProps = {
  isSmartPick?: boolean;
  className?: string;
};

export function SmartPickBadge({ isSmartPick, className = "" }: SmartPickBadgeProps) {
  if (!isSmartPick) {
    return null;
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center text-violet-600 dark:text-violet-400 ${className}`.trim()}
      title="Editor's pick - one of the smartest assets"
    >
      <BrainIcon className="h-4 w-4" />
    </span>
  );
}
