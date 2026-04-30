import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../app/providers/ToastProvider";
import { ContextDetailPage } from "./ContextDetailPage";
import { getContextDocument, logContextUsage } from "./api";
import { fetchMe } from "../auth/api";

const mockTrackEvent = vi.fn();
const mockDownloadAsMarkdown = vi.fn();

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    getContextDocument: vi.fn(),
    logContextUsage: vi.fn(),
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
  downloadAsMarkdown: (...args: unknown[]) => mockDownloadAsMarkdown(...args),
  shareOrCopyLink: vi.fn(),
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));

function mockDoc(overrides: Partial<Awaited<ReturnType<typeof getContextDocument>>> = {}) {
  return {
    id: 15,
    title: "Context Doc",
    summary: null,
    body: "# Hello\n\nWorld",
    status: "DRAFT" as const,
    visibility: "TEAM" as const,
    tools: [] as string[],
    modality: "text" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    owner: { id: 77, name: "Owner", avatarUrl: null },
    averageRating: null,
    variables: [],
    ...overrides,
  };
}

function renderContextDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/context/15"]}>
          <Routes>
            <Route path="/context/:id" element={<ContextDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("ContextDetailPage", () => {
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
    vi.mocked(getContextDocument).mockResolvedValue(mockDoc());
  });

  it("logs COPY usage and analytics when Download is clicked", async () => {
    renderContextDetail();

    expect(await screen.findByRole("heading", { name: /Context Doc/ })).toBeInTheDocument();

    await waitFor(() => {
      expect(logContextUsage).toHaveBeenCalledWith(15, "VIEW");
    });

    await userEvent.click(screen.getByRole("button", { name: /Download/i }));

    expect(mockDownloadAsMarkdown).toHaveBeenCalled();
    expect(logContextUsage).toHaveBeenCalledWith(15, "COPY");
    expect(mockTrackEvent).toHaveBeenCalledWith("context_download", {
      context_id: 15,
      source: "detail",
    });
  });
});
