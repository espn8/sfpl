import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { highlightMatches, truncateWithHighlight } from "./highlight";

describe("highlightMatches", () => {
  it("returns original text when query is empty", () => {
    const result = highlightMatches("Hello World", "");
    expect(result).toBe("Hello World");
  });

  it("returns original text when query is whitespace only", () => {
    const result = highlightMatches("Hello World", "   ");
    expect(result).toBe("Hello World");
  });

  it("returns original text when no matches found", () => {
    const result = highlightMatches("Hello World", "xyz");
    expect(result).toBe("Hello World");
  });

  it("highlights single word match", () => {
    const { container } = render(<>{highlightMatches("Hello World", "hello")}</>);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("Hello");
  });

  it("highlights multiple word matches", () => {
    const { container } = render(<>{highlightMatches("Hello World Hello", "hello")}</>);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(2);
  });

  it("highlights multiple different words", () => {
    const { container } = render(<>{highlightMatches("Hello Beautiful World", "hello world")}</>);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(2);
    expect(marks[0].textContent).toBe("Hello");
    expect(marks[1].textContent).toBe("World");
  });

  it("is case insensitive", () => {
    const { container } = render(<>{highlightMatches("HELLO world", "Hello World")}</>);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(2);
  });

  it("escapes regex special characters", () => {
    const { container } = render(<>{highlightMatches("Price: $100.00", "$100")}</>);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("$100");
  });

  it("ignores single character words", () => {
    const result = highlightMatches("A big cat", "a");
    expect(result).toBe("A big cat");
  });

  it("handles empty text", () => {
    const result = highlightMatches("", "test");
    expect(result).toBe("");
  });
});

describe("truncateWithHighlight", () => {
  it("returns full text when under max length", () => {
    const result = truncateWithHighlight("Short text", "", 100);
    expect(result).toBe("Short text");
  });

  it("truncates text when over max length without query", () => {
    const text = "This is a very long text that should be truncated";
    const result = truncateWithHighlight(text, "", 20);
    expect(result).toBe("This is a very long ...");
  });

  it("shows context around match when query provided", () => {
    const text = "The quick brown fox jumps over the lazy dog";
    const { container } = render(<>{truncateWithHighlight(text, "fox", 30)}</>);
    expect(container.textContent).toContain("fox");
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
  });

  it("handles no match found with query", () => {
    const text = "The quick brown fox jumps over the lazy dog";
    const result = truncateWithHighlight(text, "xyz", 20);
    expect(result).toBe("The quick brown fox ...");
  });
});
