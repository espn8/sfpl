import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CollectionCreateInline } from "./CollectionCreateInline";
import { listCollections, type Collection } from "../features/collections/api";
import { addPromptToCollection, removePromptFromCollection } from "../features/collections/api";
import { addSkillToCollection, removeSkillFromCollection } from "../features/skills/api";
import { addContextToCollection, removeContextFromCollection } from "../features/context/api";
import { addBuildToCollection, removeBuildFromCollection } from "../features/builds/api";

export type AssetType = "prompt" | "skill" | "context" | "build";

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

export function hasAssetInCollection(collection: Collection, assetType: AssetType, assetId: number): boolean {
  switch (assetType) {
    case "prompt":
      return collection.prompts.some((entry) => entry.prompt.id === assetId);
    case "skill":
      return collection.skills?.some((entry) => entry.skill.id === assetId) ?? false;
    case "context":
      return collection.contexts?.some((entry) => entry.context.id === assetId) ?? false;
    case "build":
      return collection.builds?.some((entry) => entry.build.id === assetId) ?? false;
    default:
      return false;
  }
}

export function useAssetCollectionMutations({
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
        case "build":
          await addBuildToCollection(assetId, collectionId);
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
            case "build":
              return {
                ...collection,
                builds: [
                  ...(collection.builds ?? []),
                  { build: { id: assetId, title: assetTitle } },
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
        case "build":
          await removeBuildFromCollection(assetId, collectionId);
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
            case "build":
              return {
                ...collection,
                builds: (collection.builds ?? []).filter((entry) => entry.build.id !== assetId),
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
  const collectionsQuery = useQuery({ queryKey: ["collections"], queryFn: () => listCollections() });
  const { addToCollectionMutation, removeFromCollectionMutation } = useAssetCollectionMutations({
    assetId,
    assetTitle,
    assetType,
  });
  const busy = addToCollectionMutation.isPending || removeFromCollectionMutation.isPending;

  return (
    <details className="group relative">
      <summary
        className="flex cursor-pointer list-none items-center justify-center rounded-md border border-transparent p-2 text-(--color-text-muted) outline-none hover:bg-(--color-surface-muted) hover:text-(--color-text) focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-2 focus-visible:ring-offset-(--color-bg) group-open:bg-(--color-surface-muted) group-open:text-(--color-text) motion-reduce:transition-none [&::-webkit-details-marker]:hidden"
        aria-label="Add to collection"
      >
        <BookmarkIcon className="h-5 w-5" />
      </summary>
      <div
        className="absolute left-0 top-full z-50 mt-1.5 flex min-w-68 max-w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) shadow-lg ring-1 ring-(--color-border) motion-reduce:shadow-md"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="border-b border-(--color-border) bg-linear-to-b from-(--color-surface-muted)/80 to-(--color-surface-muted)/30 px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-(--color-border) bg-(--color-surface) text-(--color-primary) shadow-sm">
              <BookmarkIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold leading-tight text-(--color-text)">Collections</p>
              <p className="mt-0.5 text-xs leading-snug text-(--color-text-muted)">Save this asset to a list you can share.</p>
            </div>
          </div>
        </div>

        <div className="max-h-[min(14rem,40vh)] overflow-y-auto overscroll-contain p-2">
          {collectionsQuery.isLoading ? (
            <ul className="space-y-2 px-0.5 py-1" aria-busy="true" aria-label="Loading collections">
              {[0, 1, 2].map((key) => (
                <li
                  key={key}
                  className="h-11 animate-pulse rounded-lg bg-(--color-surface-muted) motion-reduce:animate-none"
                />
              ))}
            </ul>
          ) : null}
          {!collectionsQuery.isLoading && collectionsQuery.data?.length ? (
            <ul className="space-y-0.5">
              {collectionsQuery.data.map((collection) => {
                const hasAsset = hasAssetInCollection(collection, assetType, assetId);
                return (
                  <li key={collection.id}>
                    <button
                      type="button"
                      disabled={busy}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium text-(--color-text) transition-colors hover:bg-(--color-surface-muted) active:bg-(--color-surface-muted)/80 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"
                      onClick={() => {
                        if (hasAsset) {
                          removeFromCollectionMutation.mutate(collection.id);
                          return;
                        }
                        addToCollectionMutation.mutate(collection.id);
                      }}
                    >
                      <span className="min-w-0 truncate">{collection.name}</span>
                      <span
                        className={
                          hasAsset
                            ? "shrink-0 rounded-full bg-(--color-primary)/12 px-2 py-0.5 text-[11px] font-semibold text-(--color-primary)"
                            : "shrink-0 rounded-full border border-(--color-border) bg-(--color-surface-muted)/60 px-2 py-0.5 text-[11px] font-semibold text-(--color-text-muted)"
                        }
                      >
                        {hasAsset ? "Added" : "Add"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {!collectionsQuery.isLoading && !collectionsQuery.data?.length ? (
            <div className="px-2 py-8 text-center">
              <p className="text-sm font-medium text-(--color-text)">No collections yet</p>
              <p className="mx-auto mt-1 max-w-56 text-xs leading-relaxed text-(--color-text-muted)">
                Create one below—this asset will be added automatically.
              </p>
            </div>
          ) : null}
        </div>

        <CollectionCreateInline
          variant="popoverFooter"
          disabled={busy}
          onCreated={(collection) => {
            addToCollectionMutation.mutate(collection.id);
          }}
        />
      </div>
    </details>
  );
}
