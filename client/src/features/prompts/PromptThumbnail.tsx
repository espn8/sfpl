type PromptThumbnailProps = {
  title: string;
  thumbnailUrl?: string | null;
  thumbnailStatus?: "PENDING" | "READY" | "FAILED";
  className?: string;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
};

export function PromptThumbnail({
  title,
  thumbnailUrl,
  thumbnailStatus,
  className,
  onRegenerate,
  isRegenerating,
}: PromptThumbnailProps) {
  if (thumbnailUrl) {
    return (
      <img
        src={thumbnailUrl}
        alt={`${title} thumbnail`}
        loading="lazy"
        decoding="async"
        className={className ?? "h-28 w-28 rounded object-cover"}
      />
    );
  }

  const isFailed = thumbnailStatus === "FAILED";
  const isPending = thumbnailStatus === "PENDING";
  const canRegenerate = (isFailed || isPending) && onRegenerate && !isRegenerating;

  return (
    <div
      aria-label={`${title} thumbnail placeholder`}
      className={className ?? "flex h-28 w-28 items-center justify-center rounded bg-[linear-gradient(135deg,#0176D3_0%,#06A59A_45%,#FFB75D_100%)]"}
    >
      {canRegenerate ? (
        <button
          type="button"
          onClick={onRegenerate}
          className="rounded bg-white/80 px-2 py-1 text-xs font-semibold text-[#032D60] hover:bg-white/95 transition-colors cursor-pointer"
        >
          Regenerate
        </button>
      ) : (
        <span className="rounded bg-white/80 px-2 py-1 text-xs font-semibold text-[#032D60]">
          {isRegenerating ? "Regenerating..." : isFailed ? "Failed" : "Generating..."}
        </span>
      )}
    </div>
  );
}
