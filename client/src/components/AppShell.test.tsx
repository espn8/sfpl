import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../app/providers/ThemeProvider";
import { fetchMe } from "../features/auth/api";
import { AppShell } from "./AppShell";

vi.mock("../features/auth/api", () => ({
  fetchMe: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
  updateMyProfile: vi.fn(),
  uploadProfilePhoto: vi.fn().mockResolvedValue(undefined),
}));

const defaultUser = {
  id: 1,
  email: "test@example.com",
  name: "Test User",
  avatarUrl: "https://api.dicebear.com/9.x/bottts/svg?seed=Test",
  region: "AMER",
  ou: "ANZ",
  title: "Engineer",
  onboardingCompleted: true,
  role: "MEMBER" as const,
  teamId: 42,
};

function renderAppShell() {
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
        <MemoryRouter>
          <AppShell>
            <div>Page content</div>
          </AppShell>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders settings link and displays page content", async () => {
    vi.mocked(fetchMe).mockResolvedValue(defaultUser);

    renderAppShell();

    await screen.findByText("Page content");

    const settingsLink = await screen.findByRole("link", { name: "Settings" });
    expect(settingsLink).toBeInTheDocument();
    expect(settingsLink).toHaveAttribute("href", "/settings");
  });

  it("shows welcome modal when onboarding is incomplete", async () => {
    vi.mocked(fetchMe).mockResolvedValue({
      ...defaultUser,
      onboardingCompleted: false,
      name: null,
      region: null,
      ou: null,
      title: null,
    });

    renderAppShell();

    expect(await screen.findByRole("heading", { name: "Welcome to Your AI Toolkit" })).toBeInTheDocument();
    expect(screen.getByText("Complete your profile to get started. It only takes a moment.")).toBeInTheDocument();

    const main = screen.getByRole("main");
    const gated = main.children[0] as HTMLElement;
    expect(gated).toHaveAttribute("aria-hidden", "true");
    expect(gated).toHaveAttribute("inert");
    expect(gated.className).toContain("pointer-events-none");

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Welcome to Your AI Toolkit");
  });
});
