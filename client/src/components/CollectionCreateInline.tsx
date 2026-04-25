import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createCollection, type Collection } from "../features/collections/api";

type CollectionCreateInlineProps = {
  /** Called after the collection is created successfully on the server. */
  onCreated: (collection: Collection) => void;
  disabled?: boolean;
  /**
   * `popoverFooter` — tinted footer band for the bookmark dropdown (no extra top rule).
   * `default` — compact block for disclosure panels and similar.
   */
  variant?: "default" | "popoverFooter";
};

export function CollectionCreateInline({
  onCreated,
  disabled = false,
  variant = "default",
}: CollectionCreateInlineProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (trimmed: string) => createCollection({ name: trimmed }),
    onSuccess: (collection) => {
      setName("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["collections"] });
      onCreated(collection);
    },
    onError: () => {
      setError("Could not create. Try a different name.");
    },
  });

  const busy = disabled || createMutation.isPending;

  const shellClass =
    variant === "popoverFooter"
      ? "border-t border-(--color-border) bg-(--color-surface-muted)/45 p-3"
      : "mt-2 rounded-lg border border-(--color-border) bg-(--color-surface-muted)/35 p-3";

  const labelClass =
    variant === "popoverFooter"
      ? "mb-2 text-[11px] font-semibold uppercase tracking-wide text-(--color-text-muted)"
      : "mb-2 text-xs font-semibold text-(--color-text)";

  return (
    <div className={shellClass}>
      <p className={labelClass}>New collection</p>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) {
            setError("Name is required.");
            return;
          }
          setError(null);
          createMutation.mutate(trimmed);
        }}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            placeholder="Collection name"
            maxLength={200}
            disabled={busy}
            aria-label="New collection name"
            className="min-w-0 flex-1 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) shadow-[inset_0_1px_0_0_rgba(0,0,0,0.03)] placeholder:text-(--color-text-muted) focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/25 disabled:opacity-50 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-(--color-launch) px-3.5 py-2 text-xs font-semibold text-(--color-text-inverse) shadow-sm transition-colors hover:bg-(--color-launch-hover) disabled:pointer-events-none disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90 motion-reduce:animate-none motion-reduce:opacity-70"
                aria-hidden
              />
            ) : (
              "Create"
            )}
          </button>
        </div>
        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
