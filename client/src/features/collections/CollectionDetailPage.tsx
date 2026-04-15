import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { buildShareUrl, shareOrCopyLink } from "../../lib/shareOrCopyLink";
import { deleteCollection, getCollection, removePromptFromCollection, updateCollection } from "./api";
import { PromptThumbnail } from "../prompts/PromptThumbnail";
import { ShareIcon } from "../prompts/promptActionIcons";

export function CollectionDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const collectionId = Number(params.id);
  const [message, setMessage] = useState<string | null>(null);

  const collectionQuery = useQuery({
    queryKey: ["collection", collectionId],
    queryFn: () => getCollection(collectionId),
    enabled: Number.isInteger(collectionId) && collectionId > 0,
  });
  const updateMutation = useMutation({
    mutationFn: (payload: { name?: string; description?: string }) => updateCollection(collectionId, payload),
    onSuccess: async (updatedCollection) => {
      setMessage("Collection saved.");
      trackEvent("collection_update", { collection_id: collectionId });
      await queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.setQueryData(["collection", collectionId], updatedCollection);
    },
    onError: () => {
      setMessage("Could not update collection.");
    },
  });
  const removePromptMutation = useMutation({
    mutationFn: (promptId: number) => removePromptFromCollection(collectionId, promptId),
    onSuccess: async () => {
      trackEvent("collection_prompt_remove", { collection_id: collectionId });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["collection", collectionId] }),
        queryClient.invalidateQueries({ queryKey: ["collections"] }),
      ]);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteCollection(collectionId),
    onSuccess: async () => {
      trackEvent("collection_delete", { collection_id: collectionId });
      await queryClient.invalidateQueries({ queryKey: ["collections"] });
      void navigate("/collections");
    },
    onError: () => {
      setMessage("Could not delete collection.");
    },
  });

  const collection = collectionQuery.data;

  if (collectionQuery.isLoading) {
    return <p>Loading collection...</p>;
  }

  if (!collection) {
    return <p className="text-red-700">Collection not found.</p>;
  }

  const shareUrl = buildShareUrl(`/collections/${collectionId}`);

  const handleShare = async () => {
    await shareOrCopyLink(collection.name, shareUrl);
    trackEvent("collection_share", { collection_id: collectionId, source: "detail" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">{collection.name}</h2>
          <p className="text-(--color-text-muted)">{collection.description ?? "No description."}</p>
        </div>
        <button
          type="button"
          className="rounded-md border border-(--color-border) p-2 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text)"
          aria-label="Share collection link"
          onClick={() => void handleShare()}
        >
          <ShareIcon className="h-5 w-5" />
        </button>
      </div>
      <form
        key={`${collection.id}-${collection.name}-${collection.description ?? ""}`}
        className="space-y-2 rounded border border-(--color-border) bg-(--color-surface) p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setMessage(null);
          const formData = new FormData(event.currentTarget);
          const nextName = String(formData.get("name") ?? "").trim();
          const nextDescription = String(formData.get("description") ?? "").trim();
          if (!nextName) {
            setMessage("Collection name is required.");
            return;
          }
          updateMutation.mutate({
            name: nextName,
            description: nextDescription || undefined,
          });
        }}
      >
        <h3 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">Edit Collection</h3>
        <input
          name="name"
          defaultValue={collection.name}
          className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
          placeholder="Collection name"
        />
        <textarea
          name="description"
          defaultValue={collection.description ?? ""}
          className="h-24 w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
          placeholder="Description (optional)"
        />
        {message ? <p className="text-sm text-(--color-text-muted)">{message}</p> : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-1.5"
          >
            {updateMutation.isPending ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            disabled={deleteMutation.isPending}
            className="rounded border border-red-700 px-3 py-1.5 text-red-700"
            onClick={() => {
              const shouldDelete = window.confirm(
                "Delete this collection? Prompts will remain available and only this collection will be removed.",
              );
              if (!shouldDelete) {
                return;
              }
              setMessage(null);
              deleteMutation.mutate();
            }}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete collection"}
          </button>
        </div>
      </form>
      <div className="space-y-2">
        {collection.prompts.length === 0 ? (
          <p className="text-(--color-text-muted)">No prompts in this collection yet.</p>
        ) : (
          collection.prompts.map((entry) => (
            <div key={entry.prompt.id} className="flex items-center justify-between rounded border border-(--color-border) bg-(--color-surface) p-3">
              <div className="flex items-center gap-3">
                <PromptThumbnail
                  title={entry.prompt.title}
                  thumbnailUrl={entry.prompt.thumbnailUrl}
                  thumbnailStatus={entry.prompt.thumbnailStatus}
                  className="h-12 w-12 rounded object-cover"
                />
                <Link to={`/prompts/${entry.prompt.id}`} className="link">
                  {entry.prompt.title}
                </Link>
              </div>
              <button
                type="button"
                disabled={removePromptMutation.isPending}
                className="rounded border border-(--color-border) bg-(--color-surface-muted) px-2 py-1 text-xs"
                onClick={() => {
                  removePromptMutation.mutate(entry.prompt.id);
                }}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
