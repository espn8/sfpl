import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../app/providers/ToastProvider";
import {
  listAdminUsers,
  listUserAssets,
  transferUserAssets,
  type AdminUser,
  type AdminUserAsset,
} from "./api";

type AssetBucketKey = "prompts" | "skills" | "contexts" | "builds";

const BUCKET_TO_TYPE: Record<AssetBucketKey, "PROMPT" | "SKILL" | "CONTEXT" | "BUILD"> = {
  prompts: "PROMPT",
  skills: "SKILL",
  contexts: "CONTEXT",
  builds: "BUILD",
};

function formatDueDate(d: string | null): string {
  if (!d) return "—";
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return "—";
  const days = Math.round((t - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return `Overdue ${Math.abs(days)}d`;
  if (days === 0) return "Due today";
  return `Due in ${days}d`;
}

function UserPicker({
  label,
  value,
  onChange,
  users,
  excludeId,
  isLoading,
}: {
  label: string;
  value: number | null;
  onChange: (u: AdminUser | null) => void;
  users: AdminUser[];
  excludeId?: number | null;
  isLoading: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <select
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        value={value ?? ""}
        onChange={(e) => {
          const id = Number(e.target.value);
          onChange(users.find((u) => u.id === id) ?? null);
        }}
        disabled={isLoading}
      >
        <option value="">Select a user…</option>
        {users
          .filter((u) => u.id !== excludeId)
          .map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.email} ({u.email}) · {u.role}
            </option>
          ))}
      </select>
    </label>
  );
}

function AssetBucket({
  title,
  bucketKey,
  assets,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  title: string;
  bucketKey: AssetBucketKey;
  assets: AdminUserAsset[];
  selectedIds: Set<number>;
  onToggle: (bucket: AssetBucketKey, id: number) => void;
  onToggleAll: (bucket: AssetBucketKey, assetIds: number[], checked: boolean) => void;
}) {
  if (assets.length === 0) return null;
  const allSelected = assets.every((a) => selectedIds.has(a.id));
  return (
    <div className="rounded-lg border border-(--color-border) bg-(--color-surface) p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {title} ({assets.length})
        </h3>
        <label className="flex items-center gap-2 text-xs text-(--color-text-muted)">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) =>
              onToggleAll(
                bucketKey,
                assets.map((a) => a.id),
                e.target.checked,
              )
            }
          />
          Select all
        </label>
      </div>
      <ul className="divide-y divide-(--color-border)">
        {assets.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <label className="flex min-w-0 flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.has(a.id)}
                onChange={() => onToggle(bucketKey, a.id)}
              />
              <span className="truncate">{a.title}</span>
            </label>
            <span className="shrink-0 text-xs text-(--color-text-muted)">
              {a.status}
              {a.status === "PUBLISHED" ? ` · ${formatDueDate(a.verificationDueAt)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OwnershipTransferPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState<AdminUser | null>(null);
  const [to, setTo] = useState<AdminUser | null>(null);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<Record<AssetBucketKey, Set<number>>>({
    prompts: new Set(),
    skills: new Set(),
    contexts: new Set(),
    builds: new Set(),
  });

  const usersQuery = useQuery({
    queryKey: ["admin", "users", search],
    queryFn: () => listAdminUsers(search),
    staleTime: 30_000,
  });

  const assetsQuery = useQuery({
    queryKey: ["admin", "userAssets", from?.id],
    queryFn: () => {
      if (!from) return Promise.reject(new Error("no user"));
      return listUserAssets(from.id);
    },
    enabled: from !== null,
  });

  const toggle = (bucket: AssetBucketKey, id: number) => {
    setSelected((prev) => {
      const next = new Set(prev[bucket]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [bucket]: next };
    });
  };

  const toggleAll = (bucket: AssetBucketKey, ids: number[], checked: boolean) => {
    setSelected((prev) => ({
      ...prev,
      [bucket]: checked ? new Set(ids) : new Set(),
    }));
  };

  const selectedCount = useMemo(
    () =>
      selected.prompts.size + selected.skills.size + selected.contexts.size + selected.builds.size,
    [selected],
  );

  const bulkMutation = useMutation({
    mutationFn: () => {
      if (!from || !to) throw new Error("From and To users are required");
      const types: Array<"PROMPT" | "SKILL" | "CONTEXT" | "BUILD"> = [];
      (Object.keys(selected) as AssetBucketKey[]).forEach((b) => {
        if (selected[b].size > 0) types.push(BUCKET_TO_TYPE[b]);
      });
      return transferUserAssets(from.id, {
        newOwnerId: to.id,
        reason: reason.trim() || undefined,
        assetTypes: types.length > 0 ? types : undefined,
      });
    },
    onSuccess: async (data) => {
      showToast(`Transferred ${data.total} asset(s)`, "success");
      setSelected({ prompts: new Set(), skills: new Set(), contexts: new Set(), builds: new Set() });
      await queryClient.invalidateQueries({ queryKey: ["admin", "userAssets", from?.id] });
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: () => {
      showToast("Transfer failed", "error");
    },
  });

  const users = usersQuery.data ?? [];
  const assets = assetsQuery.data;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Ownership Transfer</h1>
        <p className="text-sm text-(--color-text-muted)">
          Reassign asset ownership. Use this when a teammate leaves the business or hands off a
          collection of prompts, skills, contexts, or builds.
        </p>
      </header>

      <section className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Search users</span>
            <input
              type="text"
              className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
              placeholder="Name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <UserPicker
            label="From (departing user)"
            value={from?.id ?? null}
            onChange={(u) => {
              setFrom(u);
              setSelected({ prompts: new Set(), skills: new Set(), contexts: new Set(), builds: new Set() });
            }}
            users={users}
            excludeId={to?.id ?? null}
            isLoading={usersQuery.isLoading}
          />
          <UserPicker
            label="To (new owner)"
            value={to?.id ?? null}
            onChange={setTo}
            users={users}
            excludeId={from?.id ?? null}
            isLoading={usersQuery.isLoading}
          />
        </div>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium">Reason (optional)</span>
          <input
            type="text"
            className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
            placeholder="e.g. User left the business"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
        </label>
      </section>

      {from ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Assets owned by {from.name ?? from.email}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!to || bulkMutation.isPending}
                className="inline-flex items-center rounded-md bg-(--color-primary) px-3 py-1.5 text-sm font-semibold text-(--color-text-inverse) disabled:opacity-50"
                onClick={() => {
                  if (!to) return;
                  if (!confirm(`Transfer ALL ${assets?.totals.total ?? 0} assets to ${to.name ?? to.email}?`)) return;
                  bulkMutation.mutate();
                }}
              >
                {bulkMutation.isPending ? "Transferring…" : "Transfer all"}
              </button>
              <button
                type="button"
                disabled={!to || selectedCount === 0 || bulkMutation.isPending}
                className="inline-flex items-center rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm font-semibold text-(--color-text) disabled:opacity-50"
                onClick={async () => {
                  if (!to || !from) return;
                  const { transferOwnerApi } = await import("../assets/governance");
                  const typeMap = {
                    prompts: "prompt",
                    skills: "skill",
                    contexts: "context",
                    builds: "build",
                  } as const;
                  let total = 0;
                  for (const bucket of Object.keys(selected) as AssetBucketKey[]) {
                    for (const id of selected[bucket]) {
                      await transferOwnerApi(typeMap[bucket], id, to.id, reason.trim() || undefined);
                      total += 1;
                    }
                  }
                  showToast(`Transferred ${total} selected asset(s)`, "success");
                  setSelected({ prompts: new Set(), skills: new Set(), contexts: new Set(), builds: new Set() });
                  await queryClient.invalidateQueries({ queryKey: ["admin", "userAssets", from.id] });
                }}
              >
                Transfer selected ({selectedCount})
              </button>
            </div>
          </div>

          {assetsQuery.isLoading ? (
            <p className="text-sm text-(--color-text-muted)">Loading assets…</p>
          ) : assets && assets.totals.total === 0 ? (
            <p className="text-sm text-(--color-text-muted)">This user owns no assets.</p>
          ) : assets ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <AssetBucket
                title="Prompts"
                bucketKey="prompts"
                assets={assets.prompts}
                selectedIds={selected.prompts}
                onToggle={toggle}
                onToggleAll={toggleAll}
              />
              <AssetBucket
                title="Skills"
                bucketKey="skills"
                assets={assets.skills}
                selectedIds={selected.skills}
                onToggle={toggle}
                onToggleAll={toggleAll}
              />
              <AssetBucket
                title="Context Docs"
                bucketKey="contexts"
                assets={assets.contexts}
                selectedIds={selected.contexts}
                onToggle={toggle}
                onToggleAll={toggleAll}
              />
              <AssetBucket
                title="Builds"
                bucketKey="builds"
                assets={assets.builds}
                selectedIds={selected.builds}
                onToggle={toggle}
                onToggleAll={toggleAll}
              />
            </div>
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-(--color-text-muted)">
          Select a departing user to see their owned assets.
        </p>
      )}
    </div>
  );
}
