import { describe, expect, it } from "vitest";
import { interpolatePromptBody } from "./interpolatePrompt";

describe("interpolatePromptBody", () => {
  it("replaces bracket tokens from seed-style templates", () => {
    const { text, missingRequiredKeys } = interpolatePromptBody(
      "Hello [NAME], topic: [TOPIC]",
      [
        { key: "TOPIC", defaultValue: "x", required: false },
        { key: "NAME", defaultValue: "there", required: false },
      ],
      { TOPIC: "sales" },
    );
    expect(text).toBe("Hello there, topic: sales");
    expect(missingRequiredKeys).toEqual([]);
  });

  it("replaces mustache tokens", () => {
    const { text } = interpolatePromptBody(
      "Go {{topic}} for {{AUDIENCE}}",
      [
        { key: "topic", defaultValue: "", required: false },
        { key: "AUDIENCE", defaultValue: "readers", required: false },
      ],
      { topic: "deep" },
    );
    expect(text).toBe("Go deep for readers");
  });

  it("reports missing required fields", () => {
    const { missingRequiredKeys } = interpolatePromptBody("Need [REQ]", [{ key: "REQ", defaultValue: "", required: true }], {});
    expect(missingRequiredKeys).toEqual(["REQ"]);
  });

  it("prefers longer keys first to avoid partial substitution", () => {
    const { text } = interpolatePromptBody(
      "[AB] and [A]",
      [
        { key: "AB", defaultValue: "full", required: false },
        { key: "A", defaultValue: "one", required: false },
      ],
      {},
    );
    expect(text).toBe("full and one");
  });
});
