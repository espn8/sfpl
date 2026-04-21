import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listCollections, type Collection } from "../features/collections/api";
import { addPromptToCollection, removePromptFromCollection } from "../features/collections/api";
import { addSkillToCollection, removeSkillFromCollection } from "../features/skills/api";
import { addContextToCollection, removeContextFromCollection } from "../features/context/api";

export type AssetType = "prompt" | "skill" | "context";

type AssetCollectionMenuProps = {
  assetId: number;
  assetTitle: string;
  assetType: AssetType;
};

function BookmarkIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M6 4.5h12v15l-6-3.5-6 3.5v-15Z" strokeLinejoin="round" />
    </svg>
  );
}

function hasAssetInCollection(collection: Collection, assetType: AssetType, assetId: number): boolean {
  switch (assetType) {
    case "prompt":
      return collection.prompts.some((entry) => entry.prompt.id === assetId);
    case "skill":
      return collection.skills?.some((entry) => entry.skill.id === assetId) ?? false;
    case "context":
      return collection.contexts?.some((entry) => entry.context.id === assetId) ?? false;
    default:
      return false;
  }
}

function useAssetCollectionMutations({
  assetId,
  assetTitle,
  assetType,
}: {
  assetId: number;
  assetTitle: string;
  assetType: AssetType;
}) {
  const queryClient = useQueryClient();

  const addToCollectionMutation = useMutation({
    mutationFn: async (collectionId: number) => {
      switch (assetType) {
        case "prompt":
          await addPromptToCollection(collectionId, assetId);
          break;
        case "skill":
          await addSkillToCollection(assetId, collectionId);
          break;
        case "context":
          await addContextToCollection(assetId, collectionId);
          break;
      }
    },
    onMutate: async (collectionId: number) => {
      await queryClient.cancelQueries({ queryKey: ["collections"] });
      const previousCollections = queryClient.getQueryData<Collection[]>(["collections"]);
      queryClient.setQueryData<Collection[]>(["collections"], (current) =>
        (current ?? []).map((collection) => {
          if (collection.id !== collectionId || hasAssetInCollection(collection, assetType, assetId)) {
            return collection;
          }
          switch (assetType) {
            case "prompt":
              return {
                ...collection,
                prompts: [
                  ...collection.prompts,
                  { prompt: { id: assetId, title: assetTitle } },
                ],
              };
            case "skill":
              return {
                ...collection,
                skills: [
                  ...(collection.skills ?? []),
                  { skill: { id: assetId, title: assetTitle } },
                ],
              };
            case "context":
              return {
                ...collection,
                contexts: [
                  ...(collection.contexts ?? []),
                  { context: { id: assetId, title: assetTitle } },
                ],
              };
            default:
              return collection;
          }
        }),
      );
      return { previousCollections };
    },
    onError: (_error, _collectionId, context) => {
      if (context?.previousCollections) {
        queryClient.setQueryData(["collections"], context.previousCollections);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  const removeFromCollectionMutation = useMutation({
    mutationFn: async (collectionId: number) => {
      switch (assetType) {
        case "prompt":
          await removePromptFromCollection(collectionId, assetId);
          break;
        case "skill":
          await removeSkillFromCollection(assetId, collectionId);
          break;
        case "context":
          await removeContextFromCollection(assetId, collectionId);
          break;
      }
    },
    onMutate: async (collectionId: number) => {
      await queryClient.cancelQueries({ queryKey: ["collections"] });
      const previousCollections = queryClient.getQueryData<Collection[]>(["collections"]);
      queryClient.setQueryData<Collection[]>(["collections"], (current) =>
        (current ?? []).map((collection) => {
          if (collection.id !== collectionId) {
            return collection;
          }
          switch (assetType) {
            case "prompt":
              return {
                ...collection,
                prompts: collection.prompts.filter((entry) => entry.prompt.id !== assetId),
              };
            case "skill":
              return {
                ...collection,
                skills: (collection.skills ?? []).filter((entry) => entry.skill.id !== assetId),
              };
            case "context":
              return {
                ...collection,
                contexts: (collection.contexts ?? []).filter((entry) => entry.context.id !== assetId),
              };
            default:
              return collection;
          }
        }),
      );
      return { previousCollections };
    },
    onError: (_error, _collectionId, context) => {
      if (context?.previousCollections) {
        queryClient.setQueryData(["collections"], context.previousCollections);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  return { addToCollectionMutation, removeFromCollectionMutation };
}

export function AssetCollectionMenu({ assetId, assetTitle, assetType }: AssetCollectionMenuProps) {
  const collectionsQuery = useQuery({ queryKey: ["collections"], queryFn: listCollections });
  const { addToCollectionMutation, removeFromCollectionMutation } = useAssetCollectionMutations({
    assetId,
    assetTitle,
    assetType,
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
              const hasAsset = hasAssetInCollection(collection, assetType, assetId);
              return (
                <li key={collection.id}>
                  <button
                    type="button"
                    disabled={busy}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-(--color-surface-muted) disabled:opacity-50"
                    onClick={() => {
                      if (hasAsset) {
                        removeFromCollectionMutation.mutate(collection.id);
                        return;
                      }
                      addToCollectionMutation.mutate(collection.id);
                    }}
                  >
                    <span className="truncate">{collection.name}</span>
                    <span className="shrink-0 text-xs text-(--color-text-muted)">{hasAsset ? "Added" : "Add"}</span>
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
