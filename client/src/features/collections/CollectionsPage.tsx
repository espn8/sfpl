import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
        className="flex gap-2"
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
        <input name="name" className="rounded border px-3 py-2" placeholder="New collection name" />
        <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-white">
          Create
        </button>
      </form>
      {collectionsQuery.data?.map((collection) => (
        <div key={collection.id} className="rounded border bg-white p-4">
          <p className="font-semibold">{collection.name}</p>
          <p className="text-sm text-slate-600">{collection.description}</p>
          <p className="text-xs text-slate-500">{collection.prompts.length} prompts</p>
        </div>
      ))}
    </div>
  );
}
