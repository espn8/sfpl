import { useQuery } from "@tanstack/react-query";
import { useAssetCollectionMutations } from "../../components/AssetCollectionMenu";
import { listCollections } from "../collections/api";

type PromptCollectionMenuProps = {
  promptId: number;
  promptTitle: string;
};

export function PromptCollectionMenu({ promptId, promptTitle }: PromptCollectionMenuProps) {
  const collectionsQuery = useQuery({ queryKey: ["collections"], queryFn: () => listCollections() });
  const { addToCollectionMutation, removeFromCollectionMutation } = useAssetCollectionMutations({
    assetId: promptId,
    assetTitle: promptTitle,
    assetType: "prompt",
  });
  const busy = addToCollectionMutation.isPending || removeFromCollectionMutation.isPending;

  return (
    <details className="group relative">
      <summary
        className="flex cursor-pointer list-none items-center justify-center rounded-md border border-transparent p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text) [&::-webkit-details-marker]:hidden"
        aria-label="Add to collection"
      >
        <BookmarkIcon className="h-5 w-5" />
      </summary>
      <div
        className="absolute left-0 top-full z-20 mt-1 min-w-52 rounded-lg border border-(--color-border) bg-(--color-surface) p-2 shadow-lg"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <p className="px-1 pb-1 text-xs font-medium text-(--color-text-muted)">Your collections</p>
        {collectionsQuery.isLoading ? (
          <p className="px-1 py-2 text-xs text-(--color-text-muted)">Loading…</p>
        ) : null}
        {collectionsQuery.data?.length ? (
          <ul className="max-h-48 space-y-1 overflow-auto">
            {collectionsQuery.data.map((collection) => {
              const hasPrompt = collection.prompts.some((entry) => entry.prompt.id === promptId);
              return (
                <li key={collection.id}>
                  <button
                    type="button"
                    disabled={busy}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-(--color-surface-muted) disabled:opacity-50"
                    onClick={() => {
                      if (hasPrompt) {
                        removeFromCollectionMutation.mutate(collection.id);
                        return;
                      }
                      addToCollectionMutation.mutate(collection.id);
                    }}
                  >
                    <span className="truncate">{collection.name}</span>
                    <span className="shrink-0 text-xs text-(--color-text-muted)">{hasPrompt ? "Added" : "Add"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-1 py-2 text-xs text-(--color-text-muted)">No collections yet.</p>
        )}
      </div>
    </details>
  );
}

function BookmarkIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M6 4.5h12v15l-6-3.5-6 3.5v-15Z" strokeLinejoin="round" />
    </svg>
  );
}
