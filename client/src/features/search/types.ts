import type { PromptModality, PromptTool } from "../prompts/api";

export type AssetTypeFilter = "all" | "prompt" | "skill" | "context";
export type SortOption = "recent" | "mostUsed" | "topRated";

export type SearchFilters = {
  q: string;
  assetType: AssetTypeFilter;
  tool: PromptTool | "";
  modality: PromptModality | "";
  sort: SortOption;
  collectionId: string;
  mine: boolean;
};

export type ActiveFilter = {
  key: keyof SearchFilters;
  value: string;
  label: string;
};

export const DEFAULT_FILTERS: SearchFilters = {
  q: "",
  assetType: "all",
  tool: "",
  modality: "",
  sort: "recent",
  collectionId: "",
  mine: false,
};

export type SearchSuggestion = {
  type: "asset" | "filter";
  id?: number;
  assetType?: "prompt" | "skill" | "context";
  title?: string;
  tool?: string;
  filterKey?: keyof SearchFilters;
  filterValue?: string;
  label: string;
};

export type ParsedSearchQuery = {
  tool: PromptTool | null;
  assetType: "prompt" | "skill" | "context" | null;
  modality: PromptModality | null;
  searchTerms: string;
};
