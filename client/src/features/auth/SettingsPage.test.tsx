import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../app/providers/ThemeProvider";
import { SettingsPage } from "./SettingsPage";
import { fetchMe } from "./api";

vi.mock("./api", () => ({
  fetchMe: vi.fn(),
}));

function renderSettingsPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SettingsPage />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders user profile details after loading", async () => {
    vi.mocked(fetchMe).mockResolvedValue({
      id: 1,
      email: "test@example.com",
      name: "Test User",
      role: "MEMBER",
      teamId: 42,
    });

    renderSettingsPage();

    expect(screen.getByText("Loading settings...")).toBeInTheDocument();
    expect(await screen.findByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("MEMBER")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders an error state when user profile cannot be loaded", async () => {
    vi.mocked(fetchMe).mockRejectedValue(new Error("request failed"));

    renderSettingsPage();

    expect(await screen.findByText("Unable to load user profile.")).toBeInTheDocument();
  });
});
