type PromptThumbnailProps = {
  title: string;
  thumbnailUrl?: string | null;
  thumbnailStatus?: "PENDING" | "READY" | "FAILED";
  className?: string;
};

export function PromptThumbnail({ title, thumbnailUrl, thumbnailStatus, className }: PromptThumbnailProps) {
  if (thumbnailUrl) {
    return <img src={thumbnailUrl} alt={`${title} thumbnail`} className={className ?? "h-28 w-28 rounded object-cover"} />;
  }

  return (
    <div
      aria-label={`${title} thumbnail placeholder`}
      className={className ?? "flex h-28 w-28 items-center justify-center rounded bg-[linear-gradient(135deg,#0176D3_0%,#06A59A_45%,#FFB75D_100%)]"}
    >
      <span className="rounded bg-white/80 px-2 py-1 text-xs font-semibold text-[#032D60]">
        {thumbnailStatus === "FAILED" ? "Regenerate me" : "Generating..."}
      </span>
    </div>
  );
}
