type Visibility = "PUBLIC" | "TEAM" | "PRIVATE";

type VisibilityBadgeProps = {
  visibility: Visibility | string;
  className?: string;
};

const VISIBILITY_STYLES: Record<
  Visibility,
  { label: string; classes: string; title: string }
> = {
  PUBLIC: {
    label: "Public",
    classes:
      "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    title: "Public — visible to everyone",
  },
  TEAM: {
    label: "My Team",
    classes:
      "border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    title: "My Team — visible to members of your OU",
  },
  PRIVATE: {
    label: "Private",
    classes:
      "border-(--color-border) bg-(--color-surface-muted) text-(--color-text-muted)",
    title: "Private — visible only to you",
  },
};

export function VisibilityBadge({ visibility, className = "" }: VisibilityBadgeProps) {
  const key = (visibility as Visibility) in VISIBILITY_STYLES ? (visibility as Visibility) : null;
  if (!key) {
    return null;
  }
  const style = VISIBILITY_STYLES[key];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${style.classes} ${className}`.trim()}
      title={style.title}
    >
      {style.label}
    </span>
  );
}
