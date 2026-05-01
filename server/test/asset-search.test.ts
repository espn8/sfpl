import { describe, expect, it } from "vitest";
import { promptFreeTextWhere, splitSearchTokens } from "../src/lib/assetSearch";

describe("promptFreeTextWhere", () => {
  it("ANDs multiple tokens so irregular title spacing still matches", () => {
    const where = promptFreeTextWhere("keep my job");
    expect(where).toEqual({
      AND: [
        {
          OR: [
            { title: { contains: "keep", mode: "insensitive" } },
            { summary: { contains: "keep", mode: "insensitive" } },
            { body: { contains: "keep", mode: "insensitive" } },
            { owner: { name: { contains: "keep", mode: "insensitive" } } },
          ],
        },
        {
          OR: [
            { title: { contains: "my", mode: "insensitive" } },
            { summary: { contains: "my", mode: "insensitive" } },
            { body: { contains: "my", mode: "insensitive" } },
            { owner: { name: { contains: "my", mode: "insensitive" } } },
          ],
        },
        {
          OR: [
            { title: { contains: "job", mode: "insensitive" } },
            { summary: { contains: "job", mode: "insensitive" } },
            { body: { contains: "job", mode: "insensitive" } },
            { owner: { name: { contains: "job", mode: "insensitive" } } },
          ],
        },
      ],
    });
  });

  it("single token stays a flat OR", () => {
    const where = promptFreeTextWhere("hello");
    expect(where).toEqual({
      OR: [
        { title: { contains: "hello", mode: "insensitive" } },
        { summary: { contains: "hello", mode: "insensitive" } },
        { body: { contains: "hello", mode: "insensitive" } },
        { owner: { name: { contains: "hello", mode: "insensitive" } } },
      ],
    });
  });
});

describe("splitSearchTokens", () => {
  it("collapses whitespace", () => {
    expect(splitSearchTokens("  a   b  ")).toEqual(["a", "b"]);
  });
});
