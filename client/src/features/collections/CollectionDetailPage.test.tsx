import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionDetailPage } from "./CollectionDetailPage";
import { deleteCollection, getCollection, removePromptFromCollection, updateCollection } from "./api";

const mockNavigate = vi.fn();
const mockTrackEvent = vi.fn();

vi.mock("./api", () => ({
  getCollection: vi.fn(),
  updateCollection: vi.fn(),
  removePromptFromCollection: vi.fn(),
  deleteCollection: vi.fn(),
}));

vi.mock("../../app/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderCollectionDetailPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/collections/1"]}>
        <Routes>
          <Route path="/collections/:id" element={<CollectionDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CollectionDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCollection).mockResolvedValue({
      id: 1,
      name: "Alpha",
      description: "Initial",
      prompts: [{ prompt: { id: 10, title: "Prompt One" } }],
      skills: [],
      contexts: [],
    });
  });

  it("updates collection fields via save mutation", async () => {
    vi.mocked(updateCollection).mockResolvedValue({
      id: 1,
      name: "Alpha Updated",
      description: "Refined",
      prompts: [{ prompt: { id: 10, title: "Prompt One" } }],
      skills: [],
      contexts: [],
    });

    renderCollectionDetailPage();

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Collection name"), { target: { value: "Alpha Updated" } });
    fireEvent.change(screen.getByPlaceholderText("Description (optional)"), { target: { value: "Refined" } });

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(updateCollection).toHaveBeenCalledWith(1, {
        name: "Alpha Updated",
        description: "Refined",
      });
    });
    expect(mockTrackEvent).toHaveBeenCalledWith("collection_update", { collection_id: 1 });
  });

  it("removes a prompt from collection detail", async () => {
    vi.mocked(removePromptFromCollection).mockResolvedValue(undefined);

    renderCollectionDetailPage();

    expect(await screen.findByText("Prompt One")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(removePromptFromCollection).toHaveBeenCalledWith(1, 10);
    });
    expect(mockTrackEvent).toHaveBeenCalledWith("collection_prompt_remove", { collection_id: 1 });
  });

  it("deletes a collection and navigates back to list", async () => {
    vi.mocked(deleteCollection).mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderCollectionDetailPage();

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete collection" }));

    await waitFor(() => {
      expect(deleteCollection).toHaveBeenCalledWith(1);
    });
    expect(mockTrackEvent).toHaveBeenCalledWith("collection_delete", { collection_id: 1 });
    expect(mockNavigate).toHaveBeenCalledWith("/collections");
  });
});
