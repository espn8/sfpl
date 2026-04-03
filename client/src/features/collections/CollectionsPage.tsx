import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { createCollection, listCollections } from "./api";

export function CollectionsPage() {
  const collectionsQuery = useQuery({ queryKey: ["collections"], queryFn: listCollections });
  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: createCollection,
    onSuccess: () => {
      trackEvent("collection_create");
      void queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Collections</h2>
      <form
        className="flex gap-2 rounded border border-(--color-border) bg-(--color-surface) p-3"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const name = String(formData.get("name") ?? "").trim();
          if (!name) {
            return;
          }
          createMutation.mutate({ name });
          event.currentTarget.reset();
        }}
      >
        <input
          name="name"
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
          placeholder="New collection name"
        />
        <button type="submit" className="rounded bg-(--color-primary) px-3 py-2 text-(--color-text-inverse)">
          Create
        </button>
      </form>
      {collectionsQuery.data?.map((collection) => (
        <div key={collection.id} className="rounded border border-(--color-border) bg-(--color-surface) p-4">
          <Link to={`/collections/${collection.id}`} className="font-semibold hover:underline">
            {collection.name}
          </Link>
          <p className="text-sm text-(--color-text-muted)">{collection.description}</p>
          <p className="text-xs text-(--color-text-muted)">{collection.prompts.length} prompts</p>
        </div>
      ))}
    </div>
  );
}
