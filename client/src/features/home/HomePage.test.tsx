import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomePage } from "./HomePage";
function renderHome() {
  return render(<HomePage />);
}

describe("HomePage", () => {
  it("renders closure copy", () => {
    renderHome();

    expect(screen.getByRole("heading", { name: "The AI Library is closed." })).toBeInTheDocument();
    expect(screen.getByText("Please check out:")).toBeInTheDocument();
  });

  it("renders all shutdown destination links", () => {
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
