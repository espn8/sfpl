import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { listCollections } from "../features/collections/api";
import { type AssetType, hasAssetInCollection, useAssetCollectionMutations } from "./AssetCollectionMenu";

function BookmarkIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M6 4.5h12v15l-6-3.5-6 3.5v-15Z" strokeLinejoin="round" />
    </svg>
  );
}

export type AssetDetailCollectionsDisclosureProps = {
  assetId: number;
  assetTitle: string;
  assetType: AssetType;
};

export function AssetDetailCollectionsDisclosure({
  assetId,
  assetTitle,
  assetType,
}: AssetDetailCollectionsDisclosureProps) {
  const collectionsQuery = useQuery({ queryKey: ["collections"], queryFn: () => listCollections() });
  const { addToCollectionMutation, removeFromCollectionMutation } = useAssetCollectionMutations({
    assetId,
    assetTitle,
    assetType,
  });
  const busy = addToCollectionMutation.isPending || removeFromCollectionMutation.isPending;

  const memberCollections = useMemo(() => {
    const data = collectionsQuery.data;
    if (!data) {
      return [];
    }
    return data.filter((collection) => hasAssetInCollection(collection, assetType, assetId));
  }, [collectionsQuery.data, assetType, assetId]);

  const totalCount = collectionsQuery.data?.length ?? 0;
  const loaded = collectionsQuery.data !== undefined;

  return (
    <details className="rounded border border-(--color-border) bg-(--color-surface-muted) p-0">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-(--color-text-muted) [&::-webkit-details-marker]:hidden">
        <BookmarkIcon className="h-4 w-4 shrink-0 text-(--color-text-muted)" />
        <span>
          Collections{loaded ? ` (${totalCount})` : ""}
        </span>
        {memberCollections.length > 0 ? (
          <span className="text-xs font-normal normal-case tracking-normal text-(--color-text-muted)">
            · In {memberCollections.length}
          </span>
        ) : null}
      </summary>
      <div
        role="region"
        aria-label="Collections"
        className="space-y-3 border-t border-(--color-border) px-4 pb-4 pt-3"
      >
        {memberCollections.length > 0 ? (
          <div className="overflow-x-auto pb-1" role="group" aria-label="Collections this asset is in">
            <div className="flex flex-nowrap gap-2">
              {memberCollections.map((collection) => (
                <Link
                  key={collection.id}
                  to={`/collections/${collection.id}`}
                  className="shrink-0 rounded-full border border-(--color-border) bg-(--color-surface) px-2.5 py-0.5 text-xs font-medium text-(--color-text) hover:bg-(--color-surface-muted) hover:underline"
                >
                  {collection.name}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        {collectionsQuery.isLoading ? (
          <p className="text-sm text-(--color-text-muted)">Loading collections...</p>
        ) : null}
        {collectionsQuery.data && collectionsQuery.data.length > 0 ? (
          <div className="space-y-2">
            {collectionsQuery.data.map((collection) => {
              const hasAsset = hasAssetInCollection(collection, assetType, assetId);
              return (
                <div
                  key={collection.id}
                  className="flex items-center justify-between rounded border border-(--color-border) bg-(--color-surface) px-3 py-2"
                >
                  <p className="text-sm">{collection.name}</p>
                  <button
                    type="button"
                    className="rounded border border-(--color-border) bg-(--color-surface-muted) px-2 py-1 text-xs"
                    disabled={busy}
                    onClick={() => {
                      if (hasAsset) {
                        removeFromCollectionMutation.mutate(collection.id);
                        return;
                      }
                      addToCollectionMutation.mutate(collection.id);
                    }}
                  >
                    {hasAsset ? "Remove" : "Add"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
        {loaded && totalCount === 0 ? (
          <p className="text-sm text-(--color-text-muted)">No collections yet. Create one to organize your favorites.</p>
        ) : null}
      </div>
    </details>
  );
}
