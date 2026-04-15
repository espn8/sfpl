import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../app/providers/ThemeProvider";
import { fetchMe } from "../features/auth/api";
import { AppShell } from "./AppShell";

vi.mock("../features/auth/api", () => ({
  fetchMe: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
  updateMyProfile: vi.fn(),
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

  it("opens account settings modal with profile, appearance, and account details", async () => {
    vi.mocked(fetchMe).mockResolvedValue(defaultUser);

    const user = userEvent.setup();
    renderAppShell();

    await screen.findByText("Page content");

    const accountButton = await screen.findByRole("button", { name: "Account settings" });
    await user.click(accountButton);

    expect(await screen.findByRole("heading", { name: "Account settings" })).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("MEMBER")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByLabelText("Theme")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /display name/i })).toHaveValue("Test User");
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

    expect(await screen.findByRole("heading", { name: "Welcome to SF AI Library" })).toBeInTheDocument();
    expect(screen.getByText("Please finish your profile before continuing.")).toBeInTheDocument();
  });
});
