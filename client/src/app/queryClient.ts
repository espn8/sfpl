import { QueryClient, type DefaultOptions } from "@tanstack/react-query";

/**
 * Default TanStack Query options for the app.
 *
 * These are tuned for the homepage, which is the most expensive route:
 * - `staleTime` prevents refetching /api/assets on every back-navigation.
 * - `gcTime` keeps cached pages warm while the user is clicking around.
 * - `refetchOnWindowFocus` is disabled because the payloads are large and
 *   the data is not sensitive to tab focus changes.
 * - `retry: 1` avoids the default exponential retry storm on broken
 *   endpoints (which otherwise makes a failing page feel even slower).
 *
 * Exported so tests can assert against the exact same object that
 * `main.tsx` uses in production.
 */
export const queryClientDefaultOptions: DefaultOptions = {
  queries: {
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  },
};

export function createAppQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: queryClientDefaultOptions });
}
