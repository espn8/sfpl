import type { ReactNode } from "react";

export type AssetDetailActionBarProps = {
  left: ReactNode;
  /** Prompt launch provider picker; omit on non-prompt detail pages. */
  openIn?: ReactNode;
  primary: ReactNode;
  secondary: ReactNode;
};

/**
 * Shared shell for detail-page actions: tertiary icon cluster, optional "Open in",
 * then main + secondary CTAs. Matches the prompt detail treatment.
 */
export function AssetDetailActionBar({ left, openIn, primary, secondary }: AssetDetailActionBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) p-3">
      <div className="flex flex-wrap items-center gap-0.5">{left}</div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {openIn}
        {primary}
        {secondary}
      </div>
    </div>
  );
}
