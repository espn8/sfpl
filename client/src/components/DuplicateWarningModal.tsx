import { Link } from "react-router-dom";

export type DuplicateMatchType = "exact_title" | "similar_title" | "exact_body" | "exact_url";

export interface DuplicateMatch {
  id: number;
  title: string;
  type: DuplicateMatchType;
  similarity: number;
  ownerId: number;
  ownerName: string | null;
}

export interface DuplicateError {
  code: "DUPLICATE_DETECTED";
  message: string;
  duplicates: DuplicateMatch[];
}

type DuplicateWarningModalProps = {
  isOpen: boolean;
  assetType: "prompt" | "skill" | "context" | "build";
  duplicates: DuplicateMatch[];
  onClose: () => void;
};

function getMatchTypeLabel(type: DuplicateMatchType): string {
  switch (type) {
    case "exact_title":
      return "Exact title match";
    case "similar_title":
      return "Similar title";
    case "exact_body":
      return "Identical content";
    case "exact_url":
      return "Same URL";
    default:
      return "Match";
  }
}

function getMatchTypeColor(type: DuplicateMatchType): string {
  switch (type) {
    case "exact_body":
    case "exact_url":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    case "exact_title":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    case "similar_title":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function getAssetPath(assetType: "prompt" | "skill" | "context" | "build", id: number): string {
  switch (assetType) {
    case "prompt":
      return `/prompts/${id}`;
    case "skill":
      return `/skills/${id}`;
    case "context":
      return `/context/${id}`;
    case "build":
      return `/builds/${id}`;
    default:
      return "#";
  }
}

function getAssetLabel(assetType: "prompt" | "skill" | "context" | "build"): string {
  switch (assetType) {
    case "prompt":
      return "prompt";
    case "skill":
      return "skill";
    case "context":
      return "context file";
    case "build":
      return "build";
    default:
      return "asset";
  }
}

export function DuplicateWarningModal({
  isOpen,
  assetType,
  duplicates,
  onClose,
}: DuplicateWarningModalProps) {
  if (!isOpen || duplicates.length === 0) {
    return null;
  }

  const assetLabel = getAssetLabel(assetType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-lg rounded-lg border border-(--color-border) bg-(--color-surface) p-6 shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="duplicate-modal-title"
        aria-describedby="duplicate-modal-description"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <svg
              className="h-5 w-5 text-amber-600 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2
            id="duplicate-modal-title"
            className="text-lg font-semibold text-(--color-text)"
          >
            Duplicate {assetLabel} detected
          </h2>
        </div>

        <div id="duplicate-modal-description" className="mb-6 space-y-4">
          <p className="text-sm text-(--color-text-muted)">
            A similar {assetLabel} already exists. Please review the existing {assetLabel}(s) below
            before creating a new one.
          </p>

          <div className="max-h-64 space-y-2 overflow-y-auto">
            {duplicates.map((duplicate) => (
              <div
                key={duplicate.id}
                className="flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-3"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to={getAssetPath(assetType, duplicate.id)}
                    className="block truncate font-medium text-(--color-text) hover:text-(--color-primary) hover:underline"
                    onClick={onClose}
                  >
                    {duplicate.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getMatchTypeColor(duplicate.type)}`}
                    >
                      {getMatchTypeLabel(duplicate.type)}
                    </span>
                    {duplicate.type === "similar_title" && (
                      <span className="text-xs text-(--color-text-muted)">
                        {Math.round(duplicate.similarity * 100)}% similar
                      </span>
                    )}
                    {duplicate.ownerName && (
                      <span className="text-xs text-(--color-text-muted)">
                        by {duplicate.ownerName}
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  to={getAssetPath(assetType, duplicate.id)}
                  className="ml-3 shrink-0 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-xs font-medium text-(--color-text) hover:bg-(--color-surface-muted)"
                  onClick={onClose}
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-medium text-white hover:bg-(--color-primary-hover)"
            onClick={onClose}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export function isDuplicateError(error: unknown): error is { error: DuplicateError } {
  if (typeof error !== "object" || error === null) return false;
  const err = error as Record<string, unknown>;
  if (typeof err.error !== "object" || err.error === null) return false;
  const inner = err.error as Record<string, unknown>;
  return inner.code === "DUPLICATE_DETECTED" && Array.isArray(inner.duplicates);
}
