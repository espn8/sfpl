type ConfirmDeleteModalProps = {
  isOpen: boolean;
  title: string;
  assetType: "prompt" | "skill" | "context" | "build";
  assetName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDeleteModal({
  isOpen,
  title,
  assetType,
  assetName,
  isDeleting,
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-lg border border-(--color-border) bg-(--color-surface) p-6 shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-description"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg
              className="h-5 w-5 text-red-600 dark:text-red-400"
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
            id="delete-modal-title"
            className="text-lg font-semibold text-(--color-text)"
          >
            {title}
          </h2>
        </div>

        <div id="delete-modal-description" className="mb-6 space-y-3">
          <p className="text-sm text-(--color-text-muted)">
            You are about to permanently delete the {assetLabel}:
          </p>
          <p className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 text-sm font-medium text-(--color-text)">
            {assetName}
          </p>
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/30">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              This action cannot be undone.
            </p>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              All data and information about this {assetLabel} will be permanently removed and cannot be
              restored—including content, version history, metadata, and analytics (views, copies, ratings,
              favorites).
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-2 text-sm font-medium text-(--color-text) hover:bg-(--color-surface-muted) disabled:opacity-50"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
