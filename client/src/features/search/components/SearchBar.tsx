import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ASSET_TYPE_LABELS,
  ASSET_TYPE_OPTIONS,
  getToolLabel,
  getToolsSortedAlphabetically,
  PROMPT_MODALITY_OPTIONS,
} from "../../prompts/api";
import { useSearchSuggestions } from "../hooks/useSearchSuggestions";
import type { ActiveFilter, SearchFilters, SortOption } from "../types";
import { FilterChip } from "./FilterChip";
import { SearchSuggestions } from "./SearchSuggestions";

type SearchBarProps = {
  inputValue: string;
  onInputChange: (value: string) => void;
  filters: SearchFilters;
  activeFilters: ActiveFilter[];
  onFilterChange: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  onFilterRemove: (key: keyof SearchFilters) => void;
  onClearAll: () => void;
  onSubmit?: (query: string) => void;
  placeholder?: string;
  showFilters?: boolean;
  showSort?: boolean;
  showAssetType?: boolean;
  showModality?: boolean;
  showCollections?: boolean;
  showSuggestions?: boolean;
  showStatus?: boolean;
  isParsing?: boolean;
  collections?: Array<{ id: number; name: string }>;
  className?: string;
};

export function SearchBar({
  inputValue,
  onInputChange,
  filters,
  activeFilters,
  onFilterChange,
  onFilterRemove,
  onClearAll,
  onSubmit,
  placeholder = "Search assets...",
  showFilters = true,
  showSort = true,
  showAssetType = false,
  showModality = false,
  showCollections = false,
  showSuggestions = true,
  showStatus = false,
  isParsing = false,
  collections = [],
  className = "",
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestionsDropdown, setShowSuggestionsDropdown] = useState(false);

  const { data: suggestions, isLoading: suggestionsLoading } = useSearchSuggestions({
    query: inputValue,
    enabled: showSuggestions && isFocused && inputValue.length >= 2,
  });

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestionsDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setShowSuggestionsDropdown(false);
      inputRef.current?.blur();
    } else if (event.key === "Enter" && onSubmit && inputValue.trim()) {
      event.preventDefault();
      setShowSuggestionsDropdown(false);
      onSubmit(inputValue.trim());
    }
  }

  function handleFocus() {
    setIsFocused(true);
    if (inputValue.length >= 2) {
      setShowSuggestionsDropdown(true);
    }
  }

  function handleBlur() {
    setIsFocused(false);
  }

  function handleInputChange(value: string) {
    onInputChange(value);
    if (value.length >= 2) {
      setShowSuggestionsDropdown(true);
    } else {
      setShowSuggestionsDropdown(false);
    }
  }

  function handleFilterSelect<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    onFilterChange(key, value);
    onInputChange("");
    setShowSuggestionsDropdown(false);
  }

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div ref={containerRef} className="relative flex-1">
          <div
            className={`flex items-center gap-2 rounded-lg border bg-(--color-surface) px-3 py-2 transition-all ${
              isFocused
                ? "border-(--color-primary) ring-2 ring-(--color-primary)/20"
                : "border-(--color-border) hover:border-(--color-text-muted)"
            }`}
          >
            {isParsing ? (
              <svg
                className="h-5 w-5 shrink-0 animate-spin text-(--color-primary)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            ) : (
              <svg
                className="h-5 w-5 shrink-0 text-(--color-text-muted)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" strokeLinecap="round" />
              </svg>
            )}

            {hasActiveFilters && (
              <div className="flex flex-wrap gap-1.5">
                {activeFilters.map((filter) => (
                  <FilterChip
                    key={filter.key}
                    label={filter.label}
                    onRemove={() => onFilterRemove(filter.key)}
                    variant="primary"
                  />
                ))}
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder={hasActiveFilters ? "Add more keywords..." : placeholder}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-(--color-text-muted)"
            />

            {(inputValue || hasActiveFilters) && (
              <button
                type="button"
                onClick={onClearAll}
                className="shrink-0 text-xs text-(--color-text-muted) hover:text-(--color-text)"
              >
                Clear
              </button>
            )}

            <kbd className="hidden shrink-0 rounded border border-(--color-border) bg-(--color-surface-muted) px-1.5 py-0.5 text-xs text-(--color-text-muted) sm:inline-block">
              ⌘K
            </kbd>
          </div>

          {showSuggestions && (
            <SearchSuggestions
              query={inputValue}
              assets={suggestions.assets}
              filters={suggestions.filters}
              isLoading={suggestionsLoading}
              isVisible={showSuggestionsDropdown && inputValue.length >= 2}
              onFilterSelect={handleFilterSelect}
              onClose={() => setShowSuggestionsDropdown(false)}
            />
          )}
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2">
            {showSort && (
              <select
                value={filters.sort}
                onChange={(e) => onFilterChange("sort", e.target.value as SortOption)}
                className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
              >
                <option value="recent">Date added</option>
                <option value="updatedAt">Last updated</option>
                <option value="name">Name (A-Z)</option>
                <option value="mostUsed">Most used</option>
                <option value="topRated">Top rated</option>
              </select>
            )}

            {showStatus && (
              <select
                value={filters.status}
                onChange={(e) => onFilterChange("status", e.target.value as SearchFilters["status"])}
                className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            )}

            {showAssetType && (
              <select
                value={filters.assetType}
                onChange={(e) => onFilterChange("assetType", e.target.value as SearchFilters["assetType"])}
                className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
              >
                <option value="all">All types</option>
                {ASSET_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {ASSET_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            )}

            <select
              value={filters.tool}
              onChange={(e) => onFilterChange("tool", e.target.value as SearchFilters["tool"])}
              className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
            >
              <option value="">All tools</option>
              {getToolsSortedAlphabetically().map((tool) => (
                <option key={tool} value={tool}>
                  {getToolLabel(tool)}
                </option>
              ))}
            </select>

            {showModality && (
              <select
                value={filters.modality}
                onChange={(e) => onFilterChange("modality", e.target.value as SearchFilters["modality"])}
                className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
              >
                <option value="">All outputs</option>
                {PROMPT_MODALITY_OPTIONS.map((modality) => (
                  <option key={modality} value={modality}>
                    {modality.charAt(0).toUpperCase() + modality.slice(1)}
                  </option>
                ))}
              </select>
            )}

            {showCollections && collections.length > 0 && (
              <select
                value={filters.collectionId}
                onChange={(e) => onFilterChange("collectionId", e.target.value)}
                className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm"
              >
                <option value="">All collections</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
