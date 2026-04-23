import { getToolLabel } from "../../prompts/api";
import type { ListAssetsFacets } from "../../assets/api";
import type { SearchFilters } from "../types";

type FacetedFiltersProps = {
  facets: ListAssetsFacets | undefined;
  currentFilters: SearchFilters;
  onFilterChange: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  prompt: "Prompts",
  skill: "Skills",
  context: "Context",
  build: "Builds",
};

export function FacetedFilters({ facets, currentFilters, onFilterChange }: FacetedFiltersProps) {
  if (!facets) return null;

  const { assetType: assetTypeCounts, tool: toolCounts } = facets;

  const totalAssets = assetTypeCounts.prompt + assetTypeCounts.skill + assetTypeCounts.context + (assetTypeCounts.build ?? 0);
  if (totalAssets === 0) return null;

  const toolEntries = Object.entries(toolCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium text-(--color-text-muted)">Type:</span>
        <div className="flex flex-wrap gap-1.5">
          <FacetButton
            label="All"
            count={totalAssets}
            isActive={currentFilters.assetType === "all"}
            onClick={() => onFilterChange("assetType", "all")}
          />
          {(["prompt", "skill", "context", "build"] as const).map((type) => {
            const count = assetTypeCounts[type] ?? 0;
            return (
              <FacetButton
                key={type}
                label={ASSET_TYPE_LABELS[type]}
                count={count}
                isActive={currentFilters.assetType === type}
                onClick={() => onFilterChange("assetType", type)}
                disabled={count === 0}
              />
            );
          })}
        </div>
      </div>

      {toolEntries.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="font-medium text-(--color-text-muted)">Tool:</span>
          <div className="flex flex-wrap gap-1.5">
            <FacetButton
              label="All"
              count={null}
              isActive={!currentFilters.tool}
              onClick={() => onFilterChange("tool", "")}
            />
            {toolEntries.map(([tool, count]) => (
              <FacetButton
                key={tool}
                label={getToolLabel(tool)}
                count={count}
                isActive={currentFilters.tool === tool}
                onClick={() => onFilterChange("tool", tool as SearchFilters["tool"])}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type FacetButtonProps = {
  label: string;
  count: number | null;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
};

function FacetButton({ label, count, isActive, onClick, disabled = false }: FacetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        isActive
          ? "bg-(--color-primary) text-white"
          : disabled
            ? "bg-(--color-surface-muted) text-(--color-text-muted) opacity-50 cursor-not-allowed"
            : "bg-(--color-surface-muted) text-(--color-text) hover:bg-(--color-border)"
      }`}
    >
      {label}
      {count !== null && (
        <span className={`ml-1 ${isActive ? "opacity-80" : "text-(--color-text-muted)"}`}>({count})</span>
      )}
    </button>
  );
}
