import { useQuery } from "@tanstack/react-query";
import { fetchSearchSuggestions, type SuggestionsResponse } from "../api";

type UseSearchSuggestionsOptions = {
  query: string;
  enabled?: boolean;
  limit?: number;
};

const EMPTY_RESPONSE: SuggestionsResponse = { assets: [], filters: [] };

export function useSearchSuggestions({ query, enabled = true, limit = 8 }: UseSearchSuggestionsOptions) {
  const trimmedQuery = query.trim();

  const result = useQuery({
    queryKey: ["search", "suggestions", trimmedQuery, limit],
    queryFn: () => fetchSearchSuggestions(trimmedQuery, limit),
    enabled: enabled && trimmedQuery.length >= 2,
    staleTime: 30_000,
    gcTime: 60_000,
  });

  return {
    ...result,
    data: result.data ?? EMPTY_RESPONSE,
    hasResults: (result.data?.assets.length ?? 0) > 0 || (result.data?.filters.length ?? 0) > 0,
  };
}
