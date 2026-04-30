import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../app/providers/ToastProvider";
import { SkillDetailPage } from "./SkillDetailPage";
import { getSkill, logSkillUsage } from "./api";
import { fetchMe } from "../auth/api";

const mockTrackEvent = vi.fn();

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    getSkill: vi.fn(),
    logSkillUsage: vi.fn(),
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

function mockSkill(overrides: Partial<Awaited<ReturnType<typeof getSkill>>> = {}) {
  return {
    id: 7,
    title: "Test Skill",
    summary: null,
    skillUrl: "https://skill.example/bundle",
    supportUrl: "https://help.example/guide",
    status: "DRAFT" as const,
    visibility: "TEAM" as const,
    tools: [] as string[],
    modality: "text" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    owner: { id: 88, name: "Owner", avatarUrl: null },
    averageRating: null,
    ...overrides,
  };
}

function renderSkillDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/skills/7"]}>
          <Routes>
            <Route path="/skills/:id" element={<SkillDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("SkillDetailPage", () => {
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
    vi.mocked(getSkill).mockResolvedValue(mockSkill());
  });

  it("logs COPY usage and analytics when help Open Link is clicked", async () => {
    renderSkillDetail();

    expect(await screen.findByRole("heading", { name: /Test Skill/ })).toBeInTheDocument();

    await waitFor(() => {
      expect(logSkillUsage).toHaveBeenCalledWith(7, "VIEW");
    });

    const helpLink = screen.getByRole("link", { name: /Open Link/i });
    expect(helpLink).toHaveAttribute("href", "https://help.example/guide");
    await userEvent.click(helpLink);

    expect(logSkillUsage).toHaveBeenCalledWith(7, "COPY");
    expect(mockTrackEvent).toHaveBeenCalledWith("skill_help_open", {
      skill_id: 7,
      source: "detail",
    });
  });
});
