import { Link } from "react-router-dom";
import type { UnifiedAsset } from "./api";

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorClass =
    status === "PUBLISHED"
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      : status === "DRAFT"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      : "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400";

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  );
}

function AssetTypeBadge({ type }: { type: string }) {
  const label = type === "prompt" ? "Prompt" : type === "skill" ? "Skill" : "Context";
  return (
    <span className="ml-2 rounded bg-(--color-surface-muted) px-1.5 py-0.5 text-xs text-(--color-text-muted)">
      {label}
    </span>
  );
}

type AssetListViewProps = {
  assets: UnifiedAsset[];
};

export function AssetListView({ assets }: AssetListViewProps) {
  const getDetailPath = (asset: UnifiedAsset) => {
    switch (asset.assetType) {
      case "prompt":
        return `/prompts/${asset.id}`;
      case "skill":
        return `/skills/${asset.id}`;
      case "context":
        return `/context/${asset.id}`;
      case "build":
        return `/builds/${asset.id}`;
    }
  };

  const getEditPath = (asset: UnifiedAsset) => {
    switch (asset.assetType) {
      case "prompt":
        return `/prompts/${asset.id}/edit`;
      case "skill":
        return `/skills/${asset.id}/edit`;
      case "context":
        return `/context/${asset.id}/edit`;
      case "build":
        return `/builds/${asset.id}/edit`;
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-(--color-border)">
      <table className="min-w-full divide-y divide-(--color-border)">
        <thead className="bg-(--color-surface-muted)">
          <tr>
            <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-(--color-text-muted)">
              Name
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-(--color-text-muted)">
              Status
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-(--color-text-muted)">
              Edit
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-(--color-border) bg-(--color-surface)">
          {assets.map((asset) => (
            <tr key={`${asset.assetType}-${asset.id}`} className="hover:bg-(--color-surface-muted)/50">
              <td className="whitespace-nowrap px-3 py-2">
                <Link
                  to={getDetailPath(asset)}
                  className="text-sm font-medium text-(--color-text) hover:text-(--color-primary) hover:underline"
                >
                  {asset.title}
                </Link>
                <AssetTypeBadge type={asset.assetType} />
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <StatusBadge status={asset.status} />
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <Link
                  to={getEditPath(asset)}
                  className="inline-flex items-center gap-1 rounded-lg border border-(--color-border) bg-(--color-surface) px-2 py-1 text-xs hover:bg-(--color-surface-muted)"
                >
                  <PencilIcon className="h-3 w-3" />
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
