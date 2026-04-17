import { apiClient } from "../../api/client";
import type { ParsedSearchQuery, SearchFilters } from "./types";

export type AssetSuggestion = {
  type: "asset";
  id: number;
  assetType: "prompt" | "skill" | "context";
  title: string;
  tool: string | null;
  label: string;
};

export type FilterSuggestion = {
  type: "filter";
  filterKey: keyof SearchFilters;
  filterValue: string;
  label: string;
};

export type SuggestionsResponse = {
  assets: AssetSuggestion[];
  filters: FilterSuggestion[];
};

export async function fetchSearchSuggestions(query: string, limit = 8): Promise<SuggestionsResponse> {
  const { data } = await apiClient.get<SuggestionsResponse>("/api/search/suggestions", {
    params: { q: query, limit },
  });
  return data;
}

export async function parseNaturalLanguageQuery(query: string): Promise<ParsedSearchQuery> {
  const { data } = await apiClient.get<ParsedSearchQuery>("/api/search/parse", {
    params: { q: query },
  });
  return data;
}
