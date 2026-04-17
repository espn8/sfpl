type FilterChipProps = {
  label: string;
  onRemove: () => void;
  variant?: "default" | "primary";
};

export function FilterChip({ label, onRemove, variant = "default" }: FilterChipProps) {
  const baseClasses =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium transition-colors";
  const variantClasses =
    variant === "primary"
      ? "bg-(--color-primary)/15 text-(--color-primary) hover:bg-(--color-primary)/25"
      : "bg-(--color-surface-muted) text-(--color-text) hover:bg-(--color-border)";

  return (
    <span className={`${baseClasses} ${variantClasses}`}>
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-(--color-surface) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
        aria-label={`Remove ${label} filter`}
      >
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
        </svg>
      </button>
    </span>
  );
}
