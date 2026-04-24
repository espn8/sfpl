import { describe, expect, it } from "vitest";
import { createAppQueryClient, queryClientDefaultOptions } from "./queryClient";

/**
 * Phase 1 regression guard. If these defaults drift, the homepage
 * will refetch the expensive /api/assets response on every back-
 * navigation, undoing the caching win we intentionally introduced.
 */
describe("app QueryClient defaults", () => {
  it("uses homepage-friendly defaults", () => {
    expect(queryClientDefaultOptions.queries?.staleTime).toBe(60 * 1000);
    expect(queryClientDefaultOptions.queries?.gcTime).toBe(5 * 60 * 1000);
    expect(queryClientDefaultOptions.queries?.refetchOnWindowFocus).toBe(false);
    expect(queryClientDefaultOptions.queries?.retry).toBe(1);
  });

  it("createAppQueryClient applies the defaults to the client instance", () => {
    const client = createAppQueryClient();
    const defaults = client.getDefaultOptions().queries ?? {};
    expect(defaults.staleTime).toBe(60 * 1000);
    expect(defaults.refetchOnWindowFocus).toBe(false);
  });
});
