import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeModeToggle } from "../../components/ui/ThemeModeToggle";
import { ThemeProvider } from "./ThemeProvider";

function renderThemeToggle() {
  render(
    <ThemeProvider>
      <ThemeModeToggle />
    </ThemeProvider>,
  );
}

describe("ThemeProvider", () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to dark mode when no persisted setting exists", () => {
    renderThemeToggle();

    const select = screen.getByLabelText("Theme");
    expect(select).toHaveValue("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("loads persisted mode from localStorage", () => {
    window.localStorage.setItem("promptlibrary.theme.mode", "light");

    renderThemeToggle();

    const select = screen.getByLabelText("Theme");
    expect(select).toHaveValue("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("persists user mode updates", async () => {
    const user = userEvent.setup();
    renderThemeToggle();

    const select = screen.getByLabelText("Theme");
    await user.selectOptions(select, "light");

    expect(window.localStorage.getItem("promptlibrary.theme.mode")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
