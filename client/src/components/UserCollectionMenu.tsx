import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CollectionCreateInline } from "./CollectionCreateInline";
import {
  addUserToCollection,
  listCollections,
  removeUserFromCollection,
  type Collection,
} from "../features/collections/api";

type UserCollectionMenuProps = {
  userId: number;
  userName: string;
};

function BookmarkIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M6 4.5h12v15l-6-3.5-6 3.5v-15Z" strokeLinejoin="round" />
    </svg>
  );
}

export function hasUserInCollection(collection: Collection, userId: number): boolean {
  return collection.users?.some((entry) => entry.user.id === userId) ?? false;
}

export function useUserCollectionMutations({ userId, userName }: { userId: number; userName: string }) {
  const queryClient = useQueryClient();

  const addToCollectionMutation = useMutation({
    mutationFn: async (collectionId: number) => {
      await addUserToCollection(collectionId, userId);
    },
    onMutate: async (collectionId: number) => {
      await queryClient.cancelQueries({ queryKey: ["collections"] });
      const previousCollections = queryClient.getQueryData<Collection[]>(["collections"]);
      queryClient.setQueryData<Collection[]>(["collections"], (current) =>
        (current ?? []).map((collection) => {
          if (collection.id !== collectionId || hasUserInCollection(collection, userId)) {
            return collection;
          }
          return {
            ...collection,
            users: [
              ...(collection.users ?? []),
              {
                user: {
                  id: userId,
                  name: userName || null,
                  email: "",
                  avatarUrl: null,
                  title: null,
                },
              },
            ],
          };
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
      await removeUserFromCollection(collectionId, userId);
    },
    onMutate: async (collectionId: number) => {
      await queryClient.cancelQueries({ queryKey: ["collections"] });
      const previousCollections = queryClient.getQueryData<Collection[]>(["collections"]);
      queryClient.setQueryData<Collection[]>(["collections"], (current) =>
        (current ?? []).map((collection) => {
          if (collection.id !== collectionId) {
            return collection;
          }
          return {
            ...collection,
            users: (collection.users ?? []).filter((entry) => entry.user.id !== userId),
          };
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

export function UserCollectionMenu({ userId, userName }: UserCollectionMenuProps) {
  const collectionsQuery = useQuery({ queryKey: ["collections"], queryFn: () => listCollections() });
  const { addToCollectionMutation, removeFromCollectionMutation } = useUserCollectionMutations({
    userId,
    userName,
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
              <p className="mt-0.5 text-xs leading-snug text-(--color-text-muted)">
                Add this person to a list you can share.
              </p>
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
                const hasUser = hasUserInCollection(collection, userId);
                return (
                  <li key={collection.id}>
                    <button
                      type="button"
                      disabled={busy}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium text-(--color-text) transition-colors hover:bg-(--color-surface-muted) active:bg-(--color-surface-muted)/80 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"
                      onClick={() => {
                        if (hasUser) {
                          removeFromCollectionMutation.mutate(collection.id);
                          return;
                        }
                        addToCollectionMutation.mutate(collection.id);
                      }}
                    >
                      <span className="min-w-0 truncate">{collection.name}</span>
                      <span
                        className={
                          hasUser
                            ? "shrink-0 rounded-full bg-(--color-primary)/12 px-2 py-0.5 text-[11px] font-semibold text-(--color-primary)"
                            : "shrink-0 rounded-full border border-(--color-border) bg-(--color-surface-muted)/60 px-2 py-0.5 text-[11px] font-semibold text-(--color-text-muted)"
                        }
                      >
                        {hasUser ? "Added" : "Add"}
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
                Create one below—this person can be added automatically.
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
