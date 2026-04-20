import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchState } from "./useSearchState";

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

function wrapperWithParams(search: string) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={[`/?${search}`]}>{children}</MemoryRouter>;
  };
}

describe("useSearchState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("initializes with default filters", () => {
    const { result } = renderHook(() => useSearchState(), { wrapper });

    expect(result.current.filters).toEqual({
      q: "",
      assetType: "all",
      tool: "",
      modality: "",
      sort: "recent",
      collectionId: "",
      mine: false,
      status: "",
    });
    expect(result.current.inputValue).toBe("");
    expect(result.current.activeFilters).toEqual([]);
  });

  it("parses filters from URL params", () => {
    const { result } = renderHook(() => useSearchState(), {
      wrapper: wrapperWithParams("q=test&type=prompt&tool=cursor"),
    });

    expect(result.current.filters.q).toBe("test");
    expect(result.current.filters.assetType).toBe("prompt");
    expect(result.current.filters.tool).toBe("cursor");
    expect(result.current.inputValue).toBe("test");
  });

  it("updates input value and debounces", () => {
    const { result } = renderHook(() => useSearchState({ debounceMs: 300 }), { wrapper });

    act(() => {
      result.current.setInputValue("hello");
    });

    expect(result.current.inputValue).toBe("hello");
    expect(result.current.filters.q).toBe("hello");
    expect(result.current.debouncedFilters.q).toBe("");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debouncedFilters.q).toBe("hello");
  });

  it("sets individual filters", () => {
    const { result } = renderHook(() => useSearchState(), { wrapper });

    act(() => {
      result.current.setFilter("tool", "cursor");
    });

    expect(result.current.filters.tool).toBe("cursor");
  });

  it("clears individual filters", () => {
    const { result } = renderHook(() => useSearchState(), {
      wrapper: wrapperWithParams("tool=cursor&type=prompt"),
    });

    expect(result.current.filters.tool).toBe("cursor");

    act(() => {
      result.current.clearFilter("tool");
    });

    expect(result.current.filters.tool).toBe("");
    expect(result.current.filters.assetType).toBe("prompt");
  });

  it("clears all filters", () => {
    const { result } = renderHook(() => useSearchState(), {
      wrapper: wrapperWithParams("q=test&tool=cursor&type=prompt"),
    });

    act(() => {
      result.current.clearAllFilters();
    });

    expect(result.current.filters.q).toBe("");
    expect(result.current.filters.tool).toBe("");
    expect(result.current.filters.assetType).toBe("all");
    expect(result.current.inputValue).toBe("");
  });

  it("generates active filters correctly", () => {
    const { result } = renderHook(() => useSearchState(), {
      wrapper: wrapperWithParams("tool=cursor&type=prompt&mine=true"),
    });

    expect(result.current.activeFilters).toEqual([
      { key: "assetType", value: "prompt", label: "Prompts" },
      { key: "tool", value: "cursor", label: "Cursor" },
      { key: "mine", value: "true", label: "My Assets" },
    ]);
  });

  it("resets page when filters change", () => {
    const { result } = renderHook(() => useSearchState(), {
      wrapper: wrapperWithParams("page=5"),
    });

    expect(result.current.page).toBe(5);

    act(() => {
      result.current.setFilter("tool", "cursor");
    });

    expect(result.current.page).toBe(1);
  });

  it("handles invalid URL params gracefully", () => {
    const { result } = renderHook(() => useSearchState(), {
      wrapper: wrapperWithParams("tool=invalid&type=notreal&sort=wrong"),
    });

    expect(result.current.filters.tool).toBe("");
    expect(result.current.filters.assetType).toBe("all");
    expect(result.current.filters.sort).toBe("recent");
  });
});
