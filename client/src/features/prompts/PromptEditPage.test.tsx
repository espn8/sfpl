import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listTags } from "../tags/api";
import { PromptEditPage } from "./PromptEditPage";
import { getPrompt, regeneratePromptThumbnail, updatePrompt } from "./api";

vi.mock("../tags/api", () => ({
  listTags: vi.fn(),
}));

vi.mock("./api", () => ({
  getPrompt: vi.fn(),
  updatePrompt: vi.fn(),
  regeneratePromptThumbnail: vi.fn(),
  PROMPT_TOOL_OPTIONS: ["cursor", "claude_code", "meshmesh", "slackbot", "gemini", "notebooklm"],
  PROMPT_MODALITY_OPTIONS: ["text", "code", "image", "video", "audio", "multimodal"],
}));

const mockPromptTimestamps = {
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

function renderPromptEditPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/prompts/44/edit"]}>
        <Routes>
          <Route path="/prompts/:id/edit" element={<PromptEditPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PromptEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listTags).mockResolvedValue([]);
    vi.mocked(getPrompt).mockResolvedValue({
      ...mockPromptTimestamps,
      id: 44,
      title: "Pipeline helper",
      summary: "Summarize stage risk",
      body: "Prompt body",
      status: "DRAFT",
      visibility: "PUBLIC",
      tools: ["cursor"],
      modality: "text",
      thumbnailStatus: "FAILED",
      thumbnailError: "Previous generation failed",
    });
    vi.mocked(updatePrompt).mockResolvedValue({
      ...mockPromptTimestamps,
      id: 44,
      title: "Pipeline helper",
      summary: "Summarize stage risk",
      body: "Prompt body",
      status: "DRAFT",
      visibility: "PUBLIC",
      tools: ["cursor"],
      modality: "text",
      thumbnailStatus: "FAILED",
      thumbnailError: "Previous generation failed",
    });
    vi.mocked(regeneratePromptThumbnail).mockResolvedValue({
      ...mockPromptTimestamps,
      id: 44,
      title: "Pipeline helper",
      summary: "Summarize stage risk",
      body: "Prompt body",
      status: "DRAFT",
      visibility: "PUBLIC",
      tools: ["cursor"],
      modality: "text",
      thumbnailStatus: "PENDING",
    });
  });

  it("shows regenerate control and triggers regenerate endpoint", async () => {
    renderPromptEditPage();

    const regenerate = await screen.findByRole("button", { name: "Regenerate image" });
    await userEvent.click(regenerate);

    await waitFor(() => {
      expect(regeneratePromptThumbnail).toHaveBeenCalledWith(44);
    });
  });
});
