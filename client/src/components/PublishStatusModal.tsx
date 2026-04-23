import { useEffect, useRef } from "react";

type PublishStatusModalProps = {
  isOpen: boolean;
  assetType: "prompt" | "skill" | "context" | "build";
  onConfirm: (status: "DRAFT" | "PUBLISHED") => void;
  onClose: () => void;
};

export function PublishStatusModal({
  isOpen,
  assetType,
  onConfirm,
  onClose,
}: PublishStatusModalProps) {
  const draftButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      draftButtonRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const assetLabel =
    assetType === "prompt"
      ? "prompt"
      : assetType === "skill"
        ? "skill"
        : assetType === "build"
          ? "build"
          : "context file";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-(--color-border) bg-(--color-surface) p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-modal-title"
        aria-describedby="publish-modal-description"
      >
        <h2
          id="publish-modal-title"
          className="mb-2 text-lg font-semibold text-(--color-text)"
        >
          How would you like to save this {assetLabel}?
        </h2>
        <p
          id="publish-modal-description"
          className="mb-6 text-sm text-(--color-text-muted)"
        >
          Choose whether to keep it as a draft or publish it now.
        </p>

        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <button
            ref={draftButtonRef}
            type="button"
            className="group flex flex-col items-start rounded-lg border-2 border-(--color-border) bg-(--color-surface) p-4 text-left transition-all hover:border-(--color-primary) hover:bg-(--color-surface-muted) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20"
            onClick={() => onConfirm("DRAFT")}
          >
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </div>
            <span className="text-sm font-semibold text-(--color-text)">
              Save as Draft
            </span>
            <span className="mt-1 text-xs text-(--color-text-muted)">
              Review and refine before others can see it
            </span>
          </button>

          <button
            type="button"
            className="group flex flex-col items-start rounded-lg border-2 border-(--color-border) bg-(--color-surface) p-4 text-left transition-all hover:border-(--color-primary) hover:bg-(--color-surface-muted) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20"
            onClick={() => onConfirm("PUBLISHED")}
          >
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg
                className="h-5 w-5 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <span className="text-sm font-semibold text-(--color-text)">
              Publish Now
            </span>
            <span className="mt-1 text-xs text-(--color-text-muted)">
              Make available immediately based on visibility settings
            </span>
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-2 text-sm font-medium text-(--color-text) hover:bg-(--color-surface-muted)"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
