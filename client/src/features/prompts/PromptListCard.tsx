import { Link } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { logUsage, type PromptSummary } from "./api";
import { interpolatePromptBody } from "./interpolatePrompt";
import { defaultLaunchProviderForTools, getLaunchUrl } from "./launchProviders";
import { PromptThumbnail } from "./PromptThumbnail";
import { PromptUpdatedBadge } from "./PromptUpdatedBadge";

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function composedTextForList(prompt: PromptSummary): { text: string; canCopyOrLaunch: boolean } {
  const variables = prompt.variables ?? [];
  if (variables.length === 0) {
    const text = prompt.body ?? "";
    return { text, canCopyOrLaunch: text.length > 0 };
  }
  const { text, missingRequiredKeys } = interpolatePromptBody(
    prompt.body ?? "",
    variables.map((v) => ({
      key: v.key,
      defaultValue: v.defaultValue,
      required: v.required,
    })),
    {},
  );
  return { text, canCopyOrLaunch: missingRequiredKeys.length === 0 && text.length > 0 };
}

type PromptListCardProps = {
  prompt: PromptSummary;
  variant?: "featured" | "default";
};

export function PromptListCard({ prompt, variant = "default" }: PromptListCardProps) {
  const { text, canCopyOrLaunch } = composedTextForList(prompt);
  const provider = defaultLaunchProviderForTools(prompt.tools);
  const launchUrl = canCopyOrLaunch ? getLaunchUrl(provider, text) : "";

  const shellClass =
    variant === "featured"
      ? "overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) p-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-(--color-primary) hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
      : "overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) p-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transform-none motion-reduce:transition-none";

  return (
    <div className={shellClass}>
      <Link to={`/prompts/${prompt.id}`} className="block">
        <PromptThumbnail
          title={prompt.title}
          thumbnailUrl={prompt.thumbnailUrl}
          thumbnailStatus={prompt.thumbnailStatus}
          className="h-40 w-full object-cover"
        />
      </Link>
      <div className="p-4">
        <Link to={`/prompts/${prompt.id}`} className="block">
          <div className="flex min-w-0 items-start gap-2">
            <p
              className={
                variant === "featured" ? "min-w-0 flex-1 truncate font-semibold" : "min-w-0 flex-1 font-semibold"
              }
            >
              {prompt.title}
            </p>
            <PromptUpdatedBadge createdAt={prompt.createdAt} updatedAt={prompt.updatedAt} />
          </div>
          <p
            className={
              variant === "featured"
                ? "line-clamp-2 text-sm text-(--color-text-muted)"
                : "text-sm text-(--color-text-muted)"
            }
          >
            {prompt.summary ?? (variant === "featured" ? "No summary yet" : "No summary")}
          </p>
        </Link>
        {variant === "featured" ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-(--color-text-muted)">
            <span className="rounded border border-(--color-border) px-2 py-1">{prompt.modality}</span>
            <span className="rounded border border-(--color-border) px-2 py-1">{prompt.tools[0] ?? "general"}</span>
            <span className="ml-auto">{pluralize(prompt.usageCount, "use")}</span>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canCopyOrLaunch}
            className="rounded border border-(--color-border) bg-(--color-surface-muted) px-2 py-1 text-xs disabled:pointer-events-none disabled:opacity-50"
            onClick={() => {
              void navigator.clipboard.writeText(text);
              void logUsage(prompt.id, "COPY");
              trackEvent("prompt_copy", { prompt_id: prompt.id, source: "list" });
            }}
          >
            Copy
          </button>
          <a
            href={canCopyOrLaunch ? launchUrl : undefined}
            target="_blank"
            rel="noreferrer"
            className={`rounded border border-(--color-border) bg-(--color-surface-muted) px-2 py-1 text-xs ${!canCopyOrLaunch ? "pointer-events-none opacity-50" : ""}`}
            aria-disabled={!canCopyOrLaunch}
            onClick={(event) => {
              if (!canCopyOrLaunch) {
                event.preventDefault();
                return;
              }
              void logUsage(prompt.id, "LAUNCH");
              trackEvent("prompt_launch", { prompt_id: prompt.id, provider });
            }}
          >
            Launch
          </a>
          <Link
            to={`/prompts/${prompt.id}`}
            className="rounded border border-(--color-border) bg-(--color-surface-muted) px-2 py-1 text-xs"
          >
            View
          </Link>
        </div>
      </div>
    </div>
  );
}
