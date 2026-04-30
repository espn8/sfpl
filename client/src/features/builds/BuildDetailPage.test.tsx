import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../app/providers/ToastProvider";
import { BuildDetailPage } from "./BuildDetailPage";
import { getBuild, logBuildUsage } from "./api";
import { fetchMe } from "../auth/api";

const mockTrackEvent = vi.fn();

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    getBuild: vi.fn(),
    logBuildUsage: vi.fn(),
  };
});

vi.mock("../auth/api", () => ({
  fetchMe: vi.fn(),
}));

vi.mock("../../app/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

vi.mock("../../components/AssetCollectionMenu", () => ({
  AssetCollectionMenu: () => null,
}));

vi.mock("../../lib/shareOrCopyLink", () => ({
  buildShareUrl: (path: string) => `https://app.test${path}`,
  shareOrCopyLink: vi.fn(),
}));

function mockBuild(overrides: Partial<Awaited<ReturnType<typeof getBuild>>> = {}) {
  return {
    id: 42,
    title: "Test Build",
    summary: null,
    buildUrl: "https://build.example/app",
    supportUrl: "https://docs.example/wiki",
    status: "DRAFT" as const,
    visibility: "TEAM" as const,
    modality: "text" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    owner: { id: 99, name: "Owner", avatarUrl: null },
    averageRating: null,
    ...overrides,
  };
}

function renderBuildDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/builds/42"]}>
          <Routes>
            <Route path="/builds/:id" element={<BuildDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("BuildDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchMe).mockResolvedValue({
      id: 2,
      email: "viewer@test",
      name: "Viewer",
      avatarUrl: null,
      region: null,
      ou: null,
      title: null,
      onboardingCompleted: true,
      role: "MEMBER",
      teamId: 1,
    });
    vi.mocked(getBuild).mockResolvedValue(mockBuild());
  });

  it("logs COPY usage and analytics when documentation Open Link is clicked", async () => {
    renderBuildDetail();

    expect(await screen.findByRole("heading", { name: /Test Build/ })).toBeInTheDocument();

    await waitFor(() => {
      expect(logBuildUsage).toHaveBeenCalledWith(42, "VIEW");
    });

    const docLink = screen.getByRole("link", { name: /Open Link/i });
    expect(docLink).toHaveAttribute("href", "https://docs.example/wiki");
    await userEvent.click(docLink);

    expect(logBuildUsage).toHaveBeenCalledWith(42, "COPY");
    expect(mockTrackEvent).toHaveBeenCalledWith("build_documentation_open", {
      build_id: 42,
      source: "detail",
    });
  });
});
