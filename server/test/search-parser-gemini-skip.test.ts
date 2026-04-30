import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../src/config/env", () => ({
  env: {
    nanoBananaApiKey: "test-key-present",
  },
}));

describe("parseSearchQuery skips Gemini for plain keyword / title queries", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('does not call Gemini for "keep my job" and preserves full search terms', async () => {
    const { parseSearchQuery } = await import("../src/services/searchParser");
    const result = await parseSearchQuery("keep my job");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      tool: null,
      assetType: null,
      modality: null,
      searchTerms: "keep my job",
    });
  });
});
