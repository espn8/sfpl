import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";
import { fetchMe } from "../auth/api";

vi.mock("../auth/api", () => ({
  fetchMe: vi.fn(),
}));

function renderHome() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>,
  );
}

describe("HomePage", () => {
  it("renders closure copy", () => {
    vi.mocked(fetchMe).mockRejectedValueOnce(new Error("unauthorized"));
    renderHome();

    expect(screen.getByRole("heading", { name: "The AI Library is closed." })).toBeInTheDocument();
    expect(screen.getByText("Please check out:")).toBeInTheDocument();
  });

  it("renders all shutdown destination links", () => {
    vi.mocked(fetchMe).mockRejectedValueOnce(new Error("unauthorized"));
    renderHome();

    expect(screen.getByRole("link", { name: "#slackbot-skills" })).toHaveAttribute(
      "href",
      "https://salesforce.enterprise.slack.com/archives/C0ATDUN340M",
    );
    expect(screen.getByRole("link", { name: "AI Hub for Solutions" })).toHaveAttribute(
      "href",
      "https://qlabs-org.my.site.com/aisellerhub/",
    );
    expect(screen.getByRole("link", { name: "Agentforce Vibes Skills Library" })).toHaveAttribute(
      "href",
      "https://github.com/forcedotcom/afv-library",
    );
  });
});
