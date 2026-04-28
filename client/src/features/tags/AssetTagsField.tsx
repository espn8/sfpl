import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchMe } from "../auth/api";
import { createTag, listTags, type Tag } from "./api";
import { TagRequestModal } from "./TagRequestModal";

export type AssetTagsFieldProps = {
  canEdit: boolean;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  /** When the user cannot edit, show these tag names (e.g. from API `tags` array). */
  readOnlyTagNames?: string[];
};

export function AssetTagsField({ canEdit, selectedIds, onChange, readOnlyTagNames }: AssetTagsFieldProps) {
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe });
  const [filter, setFilter] = useState("");
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  const tagsQuery = useQuery({
    queryKey: ["tags", "picker"],
    queryFn: () => listTags({ limit: 500 }),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createTag(name),
    onSuccess: async (created: Tag) => {
      await queryClient.invalidateQueries({ queryKey: ["tags"] });
      setNewTagName("");
      if (!selectedIds.includes(created.id)) {
        onChange([...selectedIds, created.id]);
      }
    },
  });

  const filteredTags = useMemo(() => {
    const list = tagsQuery.data ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) => t.name.toLowerCase().includes(q));
  }, [tagsQuery.data, filter]);

  const isAdmin = meQuery.data?.role === "ADMIN";

  if (!canEdit) {
    const names = readOnlyTagNames ?? [];
    return (
      <div className="space-y-2 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
        <p className="text-sm font-medium">Tags</p>
        {names.length === 0 ? (
          <p className="text-xs text-(--color-text-muted)">No tags assigned.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {names.map((name) => (
              <span
                key={name}
                className="rounded-full border border-(--color-border) bg-(--color-surface) px-2.5 py-0.5 text-xs font-medium text-(--color-text)"
              >
                {name}
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-(--color-text-muted)">Only the asset owner can change tags.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Tags</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowRequestModal(true)}
              className="text-xs font-medium text-(--color-primary) underline hover:text-(--color-primary-hover)"
            >
              Request a new tag
            </button>
          </div>
        </div>

        <p className="text-xs text-(--color-text-muted)">
          Tags describe intended audience, flags (e.g. beta), or other shared facets to improve discovery.
        </p>

        {isAdmin ? (
          <div className="flex flex-wrap items-end gap-2 border-t border-(--color-border) pt-2">
            <label className="block min-w-[12rem] flex-1 text-xs">
              <span className="mb-0.5 block font-medium">Create tag (admin)</span>
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag name"
                className="w-full rounded border border-(--color-border) bg-(--color-surface) px-2 py-1.5 text-sm"
                maxLength={120}
              />
            </label>
            <button
              type="button"
              disabled={!newTagName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate(newTagName.trim())}
              className="rounded bg-(--color-primary) px-3 py-1.5 text-xs font-medium text-(--color-text-inverse) hover:bg-(--color-primary-active) disabled:opacity-50"
            >
              {createMutation.isPending ? "Saving…" : "Create"}
            </button>
            {createMutation.isError ? <span className="text-xs text-red-600">Failed (duplicate or invalid).</span> : null}
          </div>
        ) : null}

        <label className="block text-xs">
          <span className="mb-0.5 block font-medium">Search tags</span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name…"
            className="w-full rounded border border-(--color-border) bg-(--color-surface) px-2 py-1.5 text-sm"
          />
        </label>

        {tagsQuery.isLoading ? <p className="text-xs text-(--color-text-muted)">Loading tags…</p> : null}
        {!tagsQuery.isLoading && !tagsQuery.data?.length ? (
          <p className="text-xs text-(--color-text-muted)">No tags in the library yet. Request one or ask an admin.</p>
        ) : null}

        {filteredTags.length > 0 ? (
          <div className="max-h-48 overflow-y-auto rounded border border-(--color-border) bg-(--color-surface) p-2">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {filteredTags.map((tag) => (
                <label key={tag.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(tag.id)}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      onChange(
                        checked
                          ? selectedIds.includes(tag.id)
                            ? selectedIds
                            : [...selectedIds, tag.id]
                          : selectedIds.filter((id) => id !== tag.id),
                      );
                    }}
                  />
                  <span>{tag.name}</span>
                  {tag.usageCount > 0 ? (
                    <span className="text-xs text-(--color-text-muted)">({tag.usageCount})</span>
                  ) : null}
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <TagRequestModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["tag-requests"] })}
      />
    </>
  );
}
