type PromptStarsProps = {
  value: number | null;
  max?: number;
  size?: "sm" | "md";
  className?: string;
};

/** Read-only row of stars for average rating (rounded to nearest whole star). */
export function PromptAverageStars({ value, max = 5, size = "sm", className = "" }: PromptStarsProps) {
  const starClass = size === "md" ? "h-5 w-5" : "h-4 w-4";
  const clamped = value === null ? 0 : Math.max(0, Math.min(max, value));
  const filledCount = Math.round(clamped);
  const label =
    value === null ? `No ratings yet, ${max} stars scale` : `${value.toFixed(1)} out of ${max} stars average`;
  return (
    <div className={`flex items-center gap-0.5 text-amber-400 ${className}`.trim()} role="img" aria-label={label}>
      {Array.from({ length: max }, (__, index) =>
        index < filledCount ? (
          <StarFilled key={index} className={starClass} />
        ) : (
          <StarOutline key={index} className={`${starClass} text-(--color-text-muted)`} />
        ),
      )}
    </div>
  );
}

type PromptRateStarsProps = {
  value: number | null;
  onChange: (next: number) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
};

/** Click-to-rate (1–5); submits immediately via parent `onChange`. */
export function PromptRateStars({ value, onChange, disabled, size = "sm", className = "" }: PromptRateStarsProps) {
  const starClass = size === "md" ? "h-6 w-6" : "h-5 w-5";
  const current = value ?? 0;
  return (
    <div className={`flex items-center gap-0.5 ${className}`.trim()} role="group" aria-label="Your rating">
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
              onChange(starValue);
            }}
          >
            {filled ? <StarFilled className={starClass} /> : <StarOutline className={`${starClass} text-(--color-text-muted)`} />}
          </button>
        );
      })}
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
