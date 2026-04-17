import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../src/config/env", () => ({
  env: {
    nanoBananaApiKey: undefined,
  },
}));

describe("searchParser local parsing", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("parses tool from query", async () => {
    const { parseSearchQuery } = await import("../src/services/searchParser");
    const result = await parseSearchQuery("cursor prompts");
    expect(result.tool).toBe("cursor");
    expect(result.assetType).toBe("prompt");
  });

  it("parses two-word tool names", async () => {
    const { parseSearchQuery } = await import("../src/services/searchParser");
    const result = await parseSearchQuery("claude code prompts");
    expect(result.tool).toBe("claude_code");
    expect(result.assetType).toBe("prompt");
  });

  it("parses asset type from query", async () => {
    const { parseSearchQuery } = await import("../src/services/searchParser");
    const result = await parseSearchQuery("skills for sales");
    expect(result.assetType).toBe("skill");
    expect(result.searchTerms).toBe("sales");
  });

  it("parses modality from query when context suggests it", async () => {
    const { parseSearchQuery } = await import("../src/services/searchParser");
    const result = await parseSearchQuery("code generation prompts");
    expect(result.modality).toBe("code");
    expect(result.assetType).toBe("prompt");
  });

  it("extracts remaining search terms", async () => {
    const { parseSearchQuery } = await import("../src/services/searchParser");
    const result = await parseSearchQuery("cursor prompts for writing emails");
    expect(result.tool).toBe("cursor");
    expect(result.assetType).toBe("prompt");
    expect(result.searchTerms).toBe("writing emails");
  });

  it("returns null filters for plain text query", async () => {
    const { parseSearchQuery } = await import("../src/services/searchParser");
    const result = await parseSearchQuery("how to write better emails");
    expect(result.tool).toBeNull();
    expect(result.assetType).toBeNull();
    expect(result.modality).toBeNull();
    expect(result.searchTerms).toBe("how to write better emails");
  });

  it("handles tool aliases", async () => {
    const { parseSearchQuery } = await import("../src/services/searchParser");

    const gptResult = await parseSearchQuery("gpt prompts");
    expect(gptResult.tool).toBe("chatgpt");

    const slackResult = await parseSearchQuery("slack prompts");
    expect(slackResult.tool).toBe("slackbot");
  });

  it("handles asset type plural forms", async () => {
    const { parseSearchQuery } = await import("../src/services/searchParser");

    const promptsResult = await parseSearchQuery("prompts for writing");
    expect(promptsResult.assetType).toBe("prompt");

    const skillsResult = await parseSearchQuery("skills for coding");
    expect(skillsResult.assetType).toBe("skill");
  });

  it("handles context documents aliases", async () => {
    const { parseSearchQuery } = await import("../src/services/searchParser");
    const result = await parseSearchQuery("context documents about style guide");
    expect(result.assetType).toBe("context");
  });

  it("removes filler words", async () => {
    const { parseSearchQuery } = await import("../src/services/searchParser");
    const result = await parseSearchQuery("prompts for writing that help with emails");
    expect(result.assetType).toBe("prompt");
    expect(result.searchTerms).toBe("writing help emails");
  });
});
