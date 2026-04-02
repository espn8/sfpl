import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listCollections } from "../collections/api";
import { listTags } from "../tags/api";
import { PromptListPage } from "./PromptListPage";
import { listPrompts } from "./api";

vi.mock("./api", () => ({
  listPrompts: vi.fn(),
}));

vi.mock("../tags/api", () => ({
  listTags: vi.fn(),
}));

vi.mock("../collections/api", () => ({
  listCollections: vi.fn(),
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
  });

  it("renders prompt cards and filter options from API data", async () => {
    vi.mocked(listPrompts).mockResolvedValue({
      data: [
        {
          id: 12,
          title: "Draft outreach prompt",
          summary: "Summarize account notes",
          status: "DRAFT",
          createdAt: "2026-04-01T10:00:00.000Z",
          updatedAt: "2026-04-01T10:00:00.000Z",
          averageRating: 4.3,
          usageCount: 10,
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

    expect(await screen.findByText("Draft outreach prompt")).toBeInTheDocument();
    expect(screen.getByText("Summarize account notes")).toBeInTheDocument();
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
