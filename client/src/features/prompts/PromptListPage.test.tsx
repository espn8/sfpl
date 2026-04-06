import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAnalyticsOverview } from "../analytics/api";
import { fetchMe } from "../auth/api";
import { listCollections } from "../collections/api";
import { listTags } from "../tags/api";
import { PromptListPage } from "./PromptListPage";
import { listPrompts } from "./api";

vi.mock("./api", () => ({
  listPrompts: vi.fn(),
  logUsage: vi.fn().mockResolvedValue(undefined),
  PROMPT_TOOL_OPTIONS: ["cursor", "claude_code", "meshmesh", "slackbot", "gemini", "notebooklm"],
  PROMPT_MODALITY_OPTIONS: ["text", "code", "image", "video", "audio", "multimodal"],
}));

vi.mock("../tags/api", () => ({
  listTags: vi.fn(),
}));

vi.mock("../collections/api", () => ({
  listCollections: vi.fn(),
}));

vi.mock("../analytics/api", () => ({
  getAnalyticsOverview: vi.fn(),
}));

vi.mock("../auth/api", () => ({
  fetchMe: vi.fn(),
}));

function renderPromptListPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PromptListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PromptListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchMe).mockResolvedValue({
      id: 1,
      email: "admin@example.com",
      name: "Admin User",
      avatarUrl: null,
      region: null,
      ou: null,
      title: null,
      onboardingCompleted: true,
      role: "ADMIN",
      teamId: 1,
    });
    vi.mocked(getAnalyticsOverview).mockResolvedValue({
      topUsedPrompts: [{ id: 1, title: "Quota coaching", usageCount: 120 }],
      topRatedPrompts: [{ id: 1, title: "Quota coaching", averageRating: 4.8, ratingCount: 12 }],
      stalePrompts: [],
      contributors: [{ id: 9, email: "user@example.com", name: "Alex", promptCount: 7 }],
      userEngagementLeaderboard: [
        {
          id: 9,
          email: "user@example.com",
          name: "Alex",
          score: 24,
          usedCount: 10,
          favoritedCount: 8,
          feedbackCount: 6,
        },
      ],
    });
  });

  it("renders prompt cards and filter options from API data", async () => {
    vi.mocked(listPrompts).mockResolvedValue({
      data: [
        {
          id: 12,
          title: "Draft outreach prompt",
          summary: "Summarize account notes",
          body: "You are a sales assistant. Summarize: [NOTES]",
          status: "DRAFT",
          tools: ["cursor"],
          modality: "text",
          createdAt: "2026-04-01T10:00:00.000Z",
          updatedAt: "2026-04-01T10:00:00.000Z",
          averageRating: 4.3,
          usageCount: 10,
          viewCount: 3,
          favorited: false,
          myRating: null,
          owner: { id: 99, name: "Alex Author", avatarUrl: null },
          tags: [],
          thumbnailStatus: "READY",
          thumbnailUrl: "https://example.com/thumb.png",
          variables: [{ key: "NOTES", label: "Notes", defaultValue: "demo", required: false }],
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    vi.mocked(listTags).mockResolvedValue([
      {
        id: 1,
        name: "sales",
        promptCount: 10,
        createdAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-01T10:00:00.000Z",
      },
    ]);
    vi.mocked(listCollections).mockResolvedValue([{ id: 7, name: "Top prompts", description: null, prompts: [] }]);

    renderPromptListPage();

    expect(await screen.findByText("Featured Prompts")).toBeInTheDocument();
    expect((await screen.findAllByText("Draft outreach prompt")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Summarize account notes").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("img", { name: "Draft outreach prompt thumbnail" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("option", { name: "sales" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Top prompts" })).toBeInTheDocument();
  });

  it("updates query filters and paginates", async () => {
    vi.mocked(listPrompts).mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 30, totalPages: 2 },
    });
    vi.mocked(listTags).mockResolvedValue([
      {
        id: 1,
        name: "sales",
        promptCount: 10,
        createdAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-01T10:00:00.000Z",
      },
    ]);
    vi.mocked(listCollections).mockResolvedValue([{ id: 7, name: "Top prompts", description: null, prompts: [] }]);

    renderPromptListPage();

    expect(await screen.findByText("How Prompt Library Works")).toBeInTheDocument();
    expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search title, summary, or body"), { target: { value: "quota" } });

    await waitFor(() => {
      expect(listPrompts).toHaveBeenLastCalledWith(
        expect.objectContaining({
          q: "quota",
          sort: "recent",
          page: 1,
          pageSize: 20,
        }),
      );
    });

    await userEvent.click(await screen.findByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(listPrompts).toHaveBeenLastCalledWith(
        expect.objectContaining({
          q: "quota",
          sort: "recent",
          page: 2,
          pageSize: 20,
        }),
      );
    });
  });
});
