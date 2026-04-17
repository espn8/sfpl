import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToolLabel } from "../../prompts/api";
import type { AssetSuggestion, FilterSuggestion } from "../api";
import type { SearchFilters } from "../types";

type SearchSuggestionsProps = {
  query: string;
  assets: AssetSuggestion[];
  filters: FilterSuggestion[];
  isLoading: boolean;
  isVisible: boolean;
  onFilterSelect: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  onClose: () => void;
};

const ASSET_TYPE_ICONS: Record<string, string> = {
  prompt: "📝",
  skill: "⚡",
  context: "📚",
};

export function SearchSuggestions({
  query,
  assets,
  filters,
  isLoading,
  isVisible,
  onFilterSelect,
  onClose,
}: SearchSuggestionsProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const allItems = [...filters, ...assets];
  const totalItems = allItems.length;

  useEffect(() => {
    setSelectedIndex(-1);
  }, [query]);

  useEffect(() => {
    if (!isVisible) {
      setSelectedIndex(-1);
    }
  }, [isVisible]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (!isVisible || totalItems === 0) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % totalItems);
          break;
        case "ArrowUp":
          event.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
          break;
        case "Enter":
          if (selectedIndex >= 0 && selectedIndex < totalItems) {
            event.preventDefault();
            const item = allItems[selectedIndex];
            if (item.type === "filter") {
              onFilterSelect(item.filterKey, item.filterValue as SearchFilters[typeof item.filterKey]);
            } else {
              navigateToAsset(item);
            }
            onClose();
          }
          break;
        case "Escape":
          onClose();
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, totalItems, selectedIndex, allItems, onFilterSelect, onClose]);

  function navigateToAsset(asset: AssetSuggestion) {
    const routes: Record<string, string> = {
      prompt: `/prompts/${asset.id}`,
      skill: `/skills/${asset.id}`,
      context: `/context/${asset.id}`,
    };
    navigate(routes[asset.assetType] ?? `/prompts/${asset.id}`);
  }

  function handleItemClick(item: AssetSuggestion | FilterSuggestion) {
    if (item.type === "filter") {
      onFilterSelect(item.filterKey, item.filterValue as SearchFilters[typeof item.filterKey]);
    } else {
      navigateToAsset(item);
    }
    onClose();
  }

  if (!isVisible) return null;

  if (isLoading && query.length >= 2) {
    return (
      <div
        ref={containerRef}
        className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-(--color-border) bg-(--color-surface) p-3 shadow-lg"
      >
        <p className="text-sm text-(--color-text-muted)">Searching...</p>
      </div>
    );
  }

  if (query.length < 2) return null;

  if (totalItems === 0) {
    return (
      <div
        ref={containerRef}
        className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-(--color-border) bg-(--color-surface) p-3 shadow-lg"
      >
        <p className="text-sm text-(--color-text-muted)">No suggestions found for "{query}"</p>
      </div>
    );
  }

  let currentIndex = 0;

  return (
    <div
      ref={containerRef}
      className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-(--color-border) bg-(--color-surface) shadow-lg"
    >
      {filters.length > 0 && (
        <div className="border-b border-(--color-border) p-2">
          <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Filters</p>
          {filters.map((filter) => {
            const index = currentIndex++;
            const isSelected = index === selectedIndex;
            return (
              <button
                key={`${filter.filterKey}-${filter.filterValue}`}
                type="button"
                onClick={() => handleItemClick(filter)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  isSelected ? "bg-(--color-primary)/10 text-(--color-primary)" : "hover:bg-(--color-surface-muted)"
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded bg-(--color-surface-muted) text-xs">
                  🔍
                </span>
                <span>{filter.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {assets.length > 0 && (
        <div className="p-2">
          <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Assets</p>
          {assets.map((asset) => {
            const index = currentIndex++;
            const isSelected = index === selectedIndex;
            return (
              <button
                key={`${asset.assetType}-${asset.id}`}
                type="button"
                onClick={() => handleItemClick(asset)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  isSelected ? "bg-(--color-primary)/10 text-(--color-primary)" : "hover:bg-(--color-surface-muted)"
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded bg-(--color-surface-muted) text-xs">
                  {ASSET_TYPE_ICONS[asset.assetType] ?? "📄"}
                </span>
                <span className="flex-1 truncate">{asset.title}</span>
                <span className="text-xs text-(--color-text-muted)">
                  {asset.assetType.charAt(0).toUpperCase() + asset.assetType.slice(1)}
                  {asset.tool && ` · ${getToolLabel(asset.tool)}`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="border-t border-(--color-border) px-3 py-2">
        <p className="text-xs text-(--color-text-muted)">
          <kbd className="rounded border border-(--color-border) bg-(--color-surface-muted) px-1">↑</kbd>
          <kbd className="ml-1 rounded border border-(--color-border) bg-(--color-surface-muted) px-1">↓</kbd>
          <span className="ml-2">to navigate</span>
          <kbd className="ml-3 rounded border border-(--color-border) bg-(--color-surface-muted) px-1">Enter</kbd>
          <span className="ml-2">to select</span>
          <kbd className="ml-3 rounded border border-(--color-border) bg-(--color-surface-muted) px-1">Esc</kbd>
          <span className="ml-2">to close</span>
        </p>
      </div>
    </div>
  );
}
