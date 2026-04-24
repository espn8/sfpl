import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Collection } from "../features/collections/api";
import * as collectionsApi from "../features/collections/api";
import { AssetDetailCollectionsDisclosure } from "./AssetDetailCollectionsDisclosure";

function makeCollection(partial: Partial<Collection> & Pick<Collection, "id" | "name">): Collection {
  return {
    description: null,
    prompts: [],
    skills: [],
    contexts: [],
    builds: [],
    ...partial,
  };
}

describe("AssetDetailCollectionsDisclosure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(collectionsApi, "listCollections").mockResolvedValue([
      makeCollection({
        id: 1,
        name: "Alpha",
        prompts: [{ prompt: { id: 42, title: "T" } }],
      }),
      makeCollection({ id: 2, name: "Beta", prompts: [] }),
    ]);
  });

  function renderDisclosure() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AssetDetailCollectionsDisclosure assetId={42} assetTitle="My prompt" assetType="prompt" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("shows collection count in summary when loaded", async () => {
    renderDisclosure();
    expect(await screen.findByText(/Collections \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/· In 1/)).toBeInTheDocument();
  });

  it("reveals management region and member link when expanded", async () => {
    const user = userEvent.setup();
    renderDisclosure();
    await screen.findByText(/Collections \(2\)/);
    await user.click(screen.getByText(/Collections \(2\)/));
    const region = screen.getByRole("region", { name: "Collections" });
    expect(region).toBeVisible();
    const link = screen.getByRole("link", { name: "Alpha" });
    expect(link).toHaveAttribute("href", "/collections/1");
  });
});
