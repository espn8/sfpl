import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { UnifiedAsset } from "./api";

type SortDirection = "asc" | "desc" | null;
type SortColumn =
  | "name"
  | "status"
  | "views"
  | "uses"
  | "ratingCount"
  | "avgRating"
  | "favoriteCount"
  | "published"
  | "updated";

type ColumnKey =
  | "name"
  | "status"
  | "views"
  | "uses"
  | "ratingCount"
  | "avgRating"
  | "favoriteCount"
  | "published"
  | "updated"
  | "edit";

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  sortable: boolean;
  hideable: boolean;
  defaultVisible: boolean;
};

const COLUMNS: ColumnConfig[] = [
  { key: "name", label: "Name", sortable: true, hideable: false, defaultVisible: true },
  { key: "status", label: "Status", sortable: true, hideable: true, defaultVisible: true },
  { key: "views", label: "Views", sortable: true, hideable: true, defaultVisible: true },
  { key: "uses", label: "Uses", sortable: true, hideable: true, defaultVisible: true },
  { key: "ratingCount", label: "# Ratings", sortable: true, hideable: true, defaultVisible: true },
  { key: "avgRating", label: "Avg Rating", sortable: true, hideable: true, defaultVisible: true },
  { key: "favoriteCount", label: "# Favorites", sortable: true, hideable: true, defaultVisible: true },
  { key: "published", label: "Published", sortable: true, hideable: true, defaultVisible: true },
  { key: "updated", label: "Updated", sortable: true, hideable: true, defaultVisible: true },
  { key: "edit", label: "Edit", sortable: false, hideable: true, defaultVisible: true },
];

const STORAGE_KEY = "analytics-table-columns";

function loadVisibleColumns(): Set<ColumnKey> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ColumnKey[];
      return new Set(parsed);
    }
  } catch {
    // Ignore parse errors
  }
  return new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));
}

function saveVisibleColumns(columns: Set<ColumnKey>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...columns]));
}

function SortIcon({ direction }: { direction: SortDirection }) {
  if (!direction) {
    return (
      <svg className="ml-1 inline h-4 w-4 text-(--color-text-muted)" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 15l5 5 5-5M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className="ml-1 inline h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {direction === "asc" ? (
        <path d="M7 14l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

type AssetAnalyticsTableProps = {
  assets: UnifiedAsset[];
};

export function AssetAnalyticsTable({ assets }: AssetAnalyticsTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn | null>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => loadVisibleColumns());
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  useEffect(() => {
    saveVisibleColumns(visibleColumns);
  }, [visibleColumns]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    const col = COLUMNS.find((c) => c.key === key);
    if (!col?.hideable) return;
    
    const newSet = new Set(visibleColumns);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setVisibleColumns(newSet);
  };

  const sortedAssets = useMemo(() => {
    if (!sortColumn || !sortDirection) return assets;

    return [...assets].sort((a, b) => {
      let aVal: number | string | null = null;
      let bVal: number | string | null = null;

      switch (sortColumn) {
        case "name":
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "views":
          aVal = a.viewCount;
          bVal = b.viewCount;
          break;
        case "uses":
          aVal = a.usageCount;
          bVal = b.usageCount;
          break;
        case "ratingCount":
          aVal = a.ratingCount ?? 0;
          bVal = b.ratingCount ?? 0;
          break;
        case "avgRating":
          aVal = a.averageRating ?? 0;
          bVal = b.averageRating ?? 0;
          break;
        case "favoriteCount":
          aVal = a.favoriteCount;
          bVal = b.favoriteCount;
          break;
        case "published":
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case "updated":
          aVal = new Date(a.updatedAt).getTime();
          bVal = new Date(b.updatedAt).getTime();
          break;
      }

      if (aVal === null || bVal === null) return 0;
      
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }, [assets, sortColumn, sortDirection]);

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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isVisible = (key: ColumnKey) => visibleColumns.has(key);

  const downloadCsv = () => {
    const visibleCols = COLUMNS.filter((c) => isVisible(c.key) && c.key !== "edit");
    
    const escapeCell = (value: string | number | null | undefined): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const getCellValue = (asset: UnifiedAsset, key: ColumnKey): string => {
      switch (key) {
        case "name":
          return asset.title;
        case "status":
          return asset.status;
        case "views":
          return String(asset.viewCount);
        case "uses":
          return String(asset.usageCount);
        case "ratingCount":
          return asset.assetType === "prompt" ? String(asset.ratingCount ?? 0) : "";
        case "avgRating":
          return asset.assetType === "prompt" && asset.averageRating != null
            ? asset.averageRating.toFixed(1)
            : "";
        case "favoriteCount":
          return String(asset.favoriteCount);
        case "published":
          return formatDate(asset.createdAt);
        case "updated":
          return formatDate(asset.updatedAt);
        default:
          return "";
      }
    };

    const headerRow = visibleCols.map((c) => escapeCell(c.label)).join(",");
    const dataRows = sortedAssets.map((asset) =>
      visibleCols.map((c) => escapeCell(getCellValue(asset, c.key))).join(",")
    );
    
    const csvContent = [headerRow, ...dataRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `analytics-export-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderHeaderCell = (col: ColumnConfig) => {
    if (!isVisible(col.key)) return null;
    
    if (col.sortable && col.key !== "edit") {
      const isSorted = sortColumn === col.key;
      return (
        <th
          key={col.key}
          className="cursor-pointer whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-(--color-text-muted) hover:text-(--color-text)"
          onClick={() => handleSort(col.key as SortColumn)}
        >
          {col.label}
          <SortIcon direction={isSorted ? sortDirection : null} />
        </th>
      );
    }
    
    return (
      <th
        key={col.key}
        className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-(--color-text-muted)"
      >
        {col.label}
      </th>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={downloadCsv}
          className="flex items-center gap-1 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm hover:bg-(--color-surface-muted)"
        >
          <DownloadIcon className="h-4 w-4" />
          Export CSV
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            className="flex items-center gap-1 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm hover:bg-(--color-surface-muted)"
          >
            Columns
            <ChevronDownIcon className="h-4 w-4" />
          </button>
          {showColumnMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowColumnMenu(false)}
              />
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-(--color-border) bg-(--color-surface) py-1 shadow-lg">
                {COLUMNS.filter((c) => c.hideable).map((col) => (
                  <label
                    key={col.key}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-(--color-surface-muted)"
                  >
                    <input
                      type="checkbox"
                      checked={isVisible(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="h-4 w-4 rounded border-(--color-border)"
                    />
                    <span className="text-sm">{col.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-(--color-border)">
        <table className="min-w-full divide-y divide-(--color-border)">
          <thead className="bg-(--color-surface-muted)">
            <tr>
              {COLUMNS.map(renderHeaderCell)}
            </tr>
          </thead>
          <tbody className="divide-y divide-(--color-border) bg-(--color-surface)">
            {sortedAssets.map((asset) => (
              <tr key={`${asset.assetType}-${asset.id}`} className="hover:bg-(--color-surface-muted)/50">
                {isVisible("name") && (
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link
                      to={getDetailPath(asset)}
                      className="text-sm font-medium text-(--color-text) hover:text-(--color-primary) hover:underline"
                    >
                      {asset.title}
                    </Link>
                    <AssetTypeBadge type={asset.assetType} />
                  </td>
                )}
                {isVisible("status") && (
                  <td className="whitespace-nowrap px-3 py-2">
                    <StatusBadge status={asset.status} />
                  </td>
                )}
                {isVisible("views") && (
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-(--color-text)">
                    {asset.viewCount.toLocaleString()}
                  </td>
                )}
                {isVisible("uses") && (
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-(--color-text)">
                    {asset.usageCount.toLocaleString()}
                  </td>
                )}
                {isVisible("ratingCount") && (
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-(--color-text)">
                    {(asset.ratingCount ?? 0).toLocaleString()}
                  </td>
                )}
                {isVisible("avgRating") && (
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-(--color-text)">
                    {asset.averageRating != null ? asset.averageRating.toFixed(1) : "—"}
                  </td>
                )}
                {isVisible("favoriteCount") && (
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-(--color-text)">
                    {asset.favoriteCount.toLocaleString()}
                  </td>
                )}
                {isVisible("published") && (
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-(--color-text-muted)">
                    {formatDate(asset.createdAt)}
                  </td>
                )}
                {isVisible("updated") && (
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-(--color-text-muted)">
                    {formatDate(asset.updatedAt)}
                  </td>
                )}
                {isVisible("edit") && (
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link
                      to={getEditPath(asset)}
                      className="inline-flex items-center gap-1 rounded-lg border border-(--color-border) bg-(--color-surface) px-2 py-1 text-xs hover:bg-(--color-surface-muted)"
                    >
                      <PencilIcon className="h-3 w-3" />
                      Edit
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
