import { useState } from "react";

export const FEEDBACK_FLAG_OPTIONS = [
  { id: "WORKED_WELL", label: "Worked well", tone: "positive" as const },
  { id: "DID_NOT_WORK", label: "Didn't work", tone: "negative" as const },
  { id: "INACCURATE", label: "Inaccurate", tone: "negative" as const },
  { id: "OUTDATED", label: "Outdated", tone: "negative" as const },
  { id: "OFF_TOPIC", label: "Off topic", tone: "negative" as const },
] as const;

export type FeedbackFlagId = (typeof FEEDBACK_FLAG_OPTIONS)[number]["id"];

type PromptStarsProps = {
  value: number | null;
  max?: number;
  size?: "sm" | "md";
  className?: string;
  ratingCount?: number;
  flagCounts?: Record<string, number> | null;
};

/** Read-only row of stars for average rating (rounded to nearest whole star). */
export function PromptAverageStars({
  value,
  max = 5,
  size = "sm",
  className = "",
  ratingCount,
  flagCounts,
}: PromptStarsProps) {
  const starClass = size === "md" ? "h-5 w-5" : "h-4 w-4";
  const clamped = value === null ? 0 : Math.max(0, Math.min(max, value));
  const filledCount = Math.round(clamped);
  const label =
    value === null ? `No ratings yet, ${max} stars scale` : `${value.toFixed(1)} out of ${max} stars average`;

  const totalRatings = ratingCount ?? 0;
  const didNotWork = flagCounts?.DID_NOT_WORK ?? 0;
  const didNotWorkRate = totalRatings > 0 ? didNotWork / totalRatings : 0;
  const showDidNotWork = totalRatings >= 4 && didNotWorkRate >= 0.05;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <div className="flex items-center gap-0.5 text-amber-400" role="img" aria-label={label}>
        {Array.from({ length: max }, (__, index) =>
          index < filledCount ? (
            <StarFilled key={index} className={starClass} />
          ) : (
            <StarOutline key={index} className={`${starClass} text-(--color-text-muted)`} />
          ),
        )}
      </div>
      {value !== null && totalRatings > 0 ? (
        <span className="text-xs text-(--color-text-muted)">
          {value.toFixed(1)} · {totalRatings} {totalRatings === 1 ? "rating" : "ratings"}
        </span>
      ) : null}
      {showDidNotWork ? (
        <span
          className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-200"
          title={`${didNotWork} of ${totalRatings} ratings reported "didn't work"`}
        >
          {Math.round(didNotWorkRate * 100)}% said didn&apos;t work
        </span>
      ) : null}
    </div>
  );
}

type PromptRateStarsProps = {
  value: number | null;
  onChange: (next: number, extras?: { feedbackFlags?: string[] }) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  showFlags?: boolean;
  initialFlags?: string[];
};

/** Click-to-rate (1–5); submits immediately via parent `onChange`. */
export function PromptRateStars({
  value,
  onChange,
  disabled,
  size = "sm",
  className = "",
  showFlags = false,
  initialFlags = [],
}: PromptRateStarsProps) {
  const starClass = size === "md" ? "h-6 w-6" : "h-5 w-5";
  const current = value ?? 0;
  const [flags, setFlags] = useState<string[]>(initialFlags);

  const toggleFlag = (flagId: string) => {
    setFlags((prev) => {
      const next = prev.includes(flagId) ? prev.filter((f) => f !== flagId) : [...prev, flagId];
      if (value !== null && value > 0) {
        onChange(value, { feedbackFlags: next });
      }
      return next;
    });
  };

  return (
    <div className={`flex flex-col items-end gap-1 ${className}`.trim()}>
      <div className="flex items-center gap-0.5" role="group" aria-label="Your rating">
        {Array.from({ length: 5 }, (_, index) => {
          const starValue = index + 1;
          const filled = starValue <= current;
          return (
            <button
              key={starValue}
              type="button"
              disabled={disabled}
              className="rounded p-0.5 text-amber-400 transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
              aria-label={`Rate ${starValue} out of 5`}
              onClick={() => {
                onChange(starValue, flags.length > 0 ? { feedbackFlags: flags } : undefined);
              }}
            >
              {filled ? <StarFilled className={starClass} /> : <StarOutline className={`${starClass} text-(--color-text-muted)`} />}
            </button>
          );
        })}
      </div>
      {showFlags && value !== null && value > 0 ? (
        <div className="flex flex-wrap justify-end gap-1" role="group" aria-label="Optional feedback flags">
          {FEEDBACK_FLAG_OPTIONS.map((option) => {
            const active = flags.includes(option.id);
            const activeStyle =
              option.tone === "positive"
                ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100"
                : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-100";
            const inactiveStyle =
              "border-(--color-border) bg-(--color-surface) text-(--color-text-muted) hover:bg-(--color-surface-muted)";
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                onClick={() => toggleFlag(option.id)}
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-50 ${active ? activeStyle : inactiveStyle}`}
                aria-pressed={active}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function StarOutline({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinejoin="round"
        d="M12 3.5 14.2 9l5.8.5-4.4 3.8 1.4 5.7L12 16.9 6.9 19l1.4-5.7L4 9.5 9.8 9 12 3.5Z"
      />
    </svg>
  );
}

function StarFilled({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.5 14.7 9.2l7.1.6-5.4 4.7 1.7 6.9L12 17.8l-6.1 3.6 1.7-6.9-5.4-4.7 7.1-.6L12 2.5Z" />
    </svg>
  );
}
