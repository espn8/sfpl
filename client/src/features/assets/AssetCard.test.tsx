import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetCard } from "./AssetCard";
import type { UnifiedAsset } from "./api";
import { fetchMe } from "../auth/api";
import { getPrompt, logUsage } from "../prompts/api";
import { getContextDocument, logContextUsage } from "../context/api";

vi.mock("../auth/api", () => ({
  fetchMe: vi.fn(),
}));

vi.mock("../prompts/api", async () => {
  const actual = await vi.importActual<typeof import("../prompts/api")>("../prompts/api");
  return {
    ...actual,
    getPrompt: vi.fn(),
    logUsage: vi.fn(),
    toggleFavorite: vi.fn(),
    ratePrompt: vi.fn(),
  };
});

vi.mock("../context/api", () => ({
  getContextDocument: vi.fn(),
  logContextUsage: vi.fn(),
  toggleContextFavorite: vi.fn(),
}));

vi.mock("../skills/api", () => ({
  getSkill: vi.fn(),
  logSkillUsage: vi.fn(),
  toggleSkillFavorite: vi.fn(),
}));

vi.mock("../../app/analytics", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("../../app/providers/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("../prompts/PromptThumbnail", () => ({
  PromptThumbnail: () => <div />,
}));

vi.mock("../prompts/PromptCollectionMenu", () => ({
  PromptCollectionMenu: () => <div />,
}));

vi.mock("../prompts/PromptStars", () => ({
  PromptAverageStars: () => <div />,
  PromptRateStars: () => <div />,
}));

vi.mock("../prompts/promptTagChips", () => ({
  promptOwnerAvatarUrl: () => "/avatar.png",
  buildPromptTagChips: () => [],
}));

const writeText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(window.navigator, "clipboard", {
  value: { writeText },
  writable: true,
});

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const basePromptAsset: UnifiedAsset = {
  id: 11,
  assetType: "prompt",
  title: "Sample Prompt",
  summary: "A summary",
  status: "PUBLISHED",
  visibility: "TEAM",
  tools: ["cursor"],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-02-01T00:00:00Z",
  owner: { id: 1, name: "Tester", avatarUrl: null },
  viewCount: 0,
  usageCount: 0,
  favorited: false,
  favoriteCount: 0,
  modality: "text",
};

const baseContextAsset: UnifiedAsset = {
  ...basePromptAsset,
  id: 22,
  assetType: "context",
  title: "Sample Context",
};

describe("AssetCard lazy copy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeText.mockClear();
    vi.mocked(fetchMe).mockResolvedValue({
      id: 999,
      email: "other@example.com",
      name: "Other",
      avatarUrl: null,
      region: null,
      ou: null,
      title: null,
      onboardingCompleted: true,
      role: "MEMBER",
      teamId: 1,
    });
  });

  it("fetches the prompt body on click when body is absent from the list payload", async () => {
    vi.mocked(getPrompt).mockResolvedValue({
      id: 11,
      title: "Sample Prompt",
      summary: "A summary",
      body: "LAZY PROMPT BODY",
      status: "PUBLISHED",
      visibility: "TEAM",
      tools: ["cursor"],
      modality: "text",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-02-01T00:00:00Z",
      owner: { id: 1, name: "Tester", avatarUrl: null },
    } as unknown as Awaited<ReturnType<typeof getPrompt>>);

    wrap(<AssetCard asset={basePromptAsset} />);

    const useButton = await screen.findByRole("button", { name: /Use prompt/i });
    await userEvent.click(useButton);

    await waitFor(() => {
      expect(getPrompt).toHaveBeenCalledWith(11);
    });
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("LAZY PROMPT BODY");
    });
    expect(logUsage).toHaveBeenCalledWith(11, "COPY");
  });

  it("fetches the context body on click when body is absent", async () => {
    vi.mocked(getContextDocument).mockResolvedValue({
      id: 22,
      title: "Sample Context",
      summary: "A summary",
      body: "LAZY CONTEXT BODY",
      status: "PUBLISHED",
      visibility: "TEAM",
      tools: [],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-02-01T00:00:00Z",
      owner: { id: 1, name: "Tester", avatarUrl: null },
    } as unknown as Awaited<ReturnType<typeof getContextDocument>>);

    wrap(<AssetCard asset={baseContextAsset} />);

    const useButton = await screen.findByRole("button", { name: /Use context/i });
    await userEvent.click(useButton);

    await waitFor(() => {
      expect(getContextDocument).toHaveBeenCalledWith(22);
    });
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("LAZY CONTEXT BODY");
    });
    expect(logContextUsage).toHaveBeenCalledWith(22, "COPY");
  });

  it("copies directly without a network call when body is already present (builds case)", async () => {
    const buildAsset: UnifiedAsset = {
      ...basePromptAsset,
      id: 33,
      assetType: "build",
      title: "Build",
      body: "https://example.com/build",
    };

    wrap(<AssetCard asset={buildAsset} />);

    const useButton = await screen.findByRole("button", { name: /Use build/i });
    await userEvent.click(useButton);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("https://example.com/build");
    });
    expect(getPrompt).not.toHaveBeenCalled();
    expect(getContextDocument).not.toHaveBeenCalled();
  });
});
