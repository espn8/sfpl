import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";
import { fetchMe } from "../auth/api";
import { listAssets, type ListAssetsResponse } from "../assets/api";
import { getAnalyticsOverview } from "../analytics/api";

vi.mock("../auth/api", () => ({
  fetchMe: vi.fn(),
}));

vi.mock("../assets/api", () => ({
  listAssets: vi.fn(),
}));

vi.mock("../analytics/api", () => ({
  getAnalyticsOverview: vi.fn(),
}));

vi.mock("../search/api", () => ({
  parseNaturalLanguageQuery: vi.fn(),
  fetchSearchSuggestions: vi.fn().mockResolvedValue({ assets: [], filters: [] }),
}));

vi.mock("../assets/AssetCard", () => ({
  AssetCard: () => <div data-testid="asset-card" />,
}));

vi.mock("../assets/AssetAnalyticsTable", () => ({
  AssetAnalyticsTable: () => <div data-testid="asset-analytics-table" />,
}));

vi.mock("../assets/AssetListView", () => ({
  AssetListView: () => <div data-testid="asset-list-view" />,
}));

function renderHome(initialPath = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const mockUser = {
  id: 1,
  email: "u@example.com",
  name: "Sam Example",
  avatarUrl: null,
  region: null,
  ou: null,
  title: null,
  onboardingCompleted: true,
  role: "MEMBER" as const,
  teamId: 1,
};

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchMe).mockResolvedValue(mockUser);
    vi.mocked(getAnalyticsOverview).mockResolvedValue({
      topUsedAssets: [],
      topRatedPrompts: [],
      stalePrompts: [],
      contributors: [],
      userEngagementLeaderboard: [],
    });
  });

  it("renders hero content immediately while /api/assets is pending (no blocking loader)", async () => {
    let resolveAssets: ((value: ListAssetsResponse) => void) | undefined;
    vi.mocked(listAssets).mockImplementation(
      () =>
        new Promise<ListAssetsResponse>((resolve) => {
          resolveAssets = resolve;
        }),
    );

    renderHome();

    expect(screen.queryByText("Loading AI assets...")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Find the AI assets that get results/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Top Assets This Week/i })).toBeInTheDocument();
    expect(screen.getAllByTestId("top-performer-skeleton").length).toBeGreaterThan(0);

    resolveAssets?.({
      data: [],
      meta: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
        snapshot: {
          assetsPublished: 10,
          promptsPublished: 4,
          skillsPublished: 3,
          contextPublished: 2,
          buildsPublished: 1,
          activeUsers: 5,
          promptsUsed: 20,
        },
      },
    });

    await waitFor(() => {
      expect(screen.queryAllByTestId("top-performer-skeleton")).toHaveLength(0);
    });
  });

  it("shows inline error banner for top performers without replacing the page", async () => {
    vi.mocked(listAssets).mockImplementation(async (filters) => {
      if (filters?.sort === "mostUsed") {
        throw new Error("boom");
      }
      return {
        data: [],
        meta: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
          snapshot: {
            assetsPublished: 0,
            promptsPublished: 0,
            skillsPublished: 0,
            contextPublished: 0,
            buildsPublished: 0,
            activeUsers: 0,
            promptsUsed: 0,
          },
        },
      };
    });

    renderHome();

    await waitFor(() => {
      expect(
        screen.getByText(/couldn't load top performers right now/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("heading", {
        name: /Find the AI assets that get results/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows skeleton (not blocking loader) for mine view while loading", async () => {
    let resolveAssets: ((value: ListAssetsResponse) => void) | undefined;
    vi.mocked(listAssets).mockImplementation(
      () =>
        new Promise<ListAssetsResponse>((resolve) => {
          resolveAssets = resolve;
        }),
    );

    renderHome("/?mine=true");

    expect(screen.queryByText("Loading AI assets...")).not.toBeInTheDocument();
    expect(screen.getByTestId("mine-assets-skeleton")).toBeInTheDocument();

    resolveAssets?.({
      data: [],
      meta: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
        snapshot: {
          assetsPublished: 0,
          promptsPublished: 0,
          skillsPublished: 0,
          contextPublished: 0,
          buildsPublished: 0,
          activeUsers: 0,
          promptsUsed: 0,
        },
      },
    });

    await waitFor(() => {
      expect(screen.queryByTestId("mine-assets-skeleton")).not.toBeInTheDocument();
    });
  });
});
