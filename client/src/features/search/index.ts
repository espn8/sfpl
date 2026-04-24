export { fetchSearchSuggestions, parseNaturalLanguageQuery } from "./api";
export type { AssetSuggestion, FilterSuggestion, SuggestionsResponse } from "./api";
export { FacetedFilters } from "./components/FacetedFilters";
export { FilterChip } from "./components/FilterChip";
export { SearchBar } from "./components/SearchBar";
export { SearchEmptyState } from "./components/SearchEmptyState";
export { SearchSuggestions } from "./components/SearchSuggestions";
// Intentionally NOT re-exporting SearchResultsPage here — router.tsx lazy-
// loads it directly from "./SearchResultsPage", and re-exporting through this
// barrel would drag the whole search results page into any caller that just
// wants the small search utilities (AssetCard, HomePage, etc.).
export { SearchProvider, useSearchContext } from "./context/SearchContext";
export { useSearchState } from "./hooks/useSearchState";
export { useSearchSuggestions } from "./hooks/useSearchSuggestions";
export type {
  ActiveFilter,
  AssetStatus,
  AssetTypeFilter,
  ParsedSearchQuery,
  SearchFilters,
  SearchSuggestion,
  SortOption,
} from "./types";
export { DEFAULT_FILTERS } from "./types";
export { highlightMatches, truncateWithHighlight } from "./utils/highlight";
