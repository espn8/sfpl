import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useMemo } from "react";
import {
  fetchNeedsVerification,
  formatDaysUntil,
  type NeedsVerificationAsset,
  verifyAssetApi,
} from "../assets/governance";
import type { AssetType } from "../assets/api";

type RowProps = {
  asset: NeedsVerificationAsset;
  assetType: AssetType;
  onVerified: () => Promise<void> | void;
};

function dueTone(verificationDueAt: string | null | undefined): string {
  if (!verificationDueAt) return "text-(--color-text-muted)";
  const due = new Date(verificationDueAt).getTime();
  if (!Number.isFinite(due)) return "text-(--color-text-muted)";
  if (due < Date.now()) return "text-red-600";
  return "text-amber-600";
}

function detailPath(assetType: AssetType, id: number): string {
  switch (assetType) {
    case "prompt":
      return `/prompts/${id}`;
    case "skill":
      return `/skills/${id}`;
    case "context":
      return `/context/${id}`;
    case "build":
      return `/builds/${id}`;
  }
}

function AssetRow({ asset, assetType, onVerified }: RowProps) {
  const mutation = useMutation({
    mutationFn: () => verifyAssetApi(assetType, asset.id),
    onSuccess: async () => {
      await onVerified();
    },
  });
  const until = formatDaysUntil(asset.verificationDueAt);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-(--color-border) py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <Link to={detailPath(assetType, asset.id)} className="truncate font-medium hover:underline">
          {asset.title}
        </Link>
        <p className={`text-xs ${dueTone(asset.verificationDueAt)}`}>
          {until === "overdue" ? "Overdue" : `Due in ${until}`}
        </p>
      </div>
      <button
        type="button"
        disabled={mutation.isPending}
        className="inline-flex items-center rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1 text-xs font-semibold text-(--color-text) hover:bg-(--color-surface-muted) disabled:opacity-60"
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Verifying…" : "Verify"}
      </button>
    </div>
  );
}

export function MyAssetsSection() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["me", "needs-verification"],
    queryFn: () => fetchNeedsVerification(7),
    staleTime: 60_000,
  });

  const refetch = async () => {
    await queryClient.invalidateQueries({ queryKey: ["me", "needs-verification"] });
    await queryClient.invalidateQueries({ queryKey: ["assets"] });
    await queryClient.invalidateQueries({ queryKey: ["prompts"] });
    await queryClient.invalidateQueries({ queryKey: ["skills"] });
    await queryClient.invalidateQueries({ queryKey: ["context"] });
    await queryClient.invalidateQueries({ queryKey: ["builds"] });
  };

  const sections = useMemo(() => {
    if (!query.data) return [] as Array<{ label: string; assetType: AssetType; items: NeedsVerificationAsset[] }>;
    const { prompts, skills, contexts, builds } = query.data;
    return [
      { label: "Prompts", assetType: "prompt" as const, items: prompts },
      { label: "Skills", assetType: "skill" as const, items: skills },
      { label: "Context Docs", assetType: "context" as const, items: contexts },
      { label: "Builds", assetType: "build" as const, items: builds },
    ];
  }, [query.data]);

  const total = sections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <section className="rounded-lg border border-(--color-border) bg-(--color-surface) p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">My Assets</h2>
        <span className="text-xs text-(--color-text-muted)">Needs re-verification within 7 days</span>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-(--color-text-muted)">Loading…</p>
      ) : query.isError ? (
        <p className="text-sm text-red-600">Couldn&apos;t load your assets.</p>
      ) : total === 0 ? (
        <p className="text-sm text-(--color-text-muted)">
          Nothing to verify right now. Assets become due every 30 days after verification.
        </p>
      ) : (
        <div className="space-y-4">
          {sections.map((section) =>
            section.items.length === 0 ? null : (
              <div key={section.label}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">
                  {section.label} ({section.items.length})
                </h3>
                <div>
                  {section.items.map((asset) => (
                    <AssetRow
                      key={`${section.assetType}-${asset.id}`}
                      asset={asset}
                      assetType={section.assetType}
                      onVerified={refetch}
                    />
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}
