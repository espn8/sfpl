import { describe, expect, it, vi } from "vitest";
import { shouldShowRecentlyUpdatedBadge } from "./recentPromptUpdate";

describe("shouldShowRecentlyUpdatedBadge", () => {
  it("returns false when created and updated are the same instant", () => {
    const t = "2026-04-01T12:00:00.000Z";
    expect(shouldShowRecentlyUpdatedBadge(t, t, Date.parse("2026-04-01T13:00:00.000Z"))).toBe(false);
  });

  it("returns false when last update is older than 72 hours", () => {
    const created = "2026-01-01T00:00:00.000Z";
    const updated = "2026-04-01T00:00:00.000Z";
    const now = Date.parse("2026-04-04T01:00:00.000Z"); // >72h after updated
    expect(shouldShowRecentlyUpdatedBadge(created, updated, now)).toBe(false);
  });

  it("returns true when updated meaningfully after create and within 72 hours", () => {
    const created = "2026-04-06T00:00:00.000Z";
    const updated = "2026-04-06T02:00:00.000Z";
    const now = Date.parse("2026-04-06T12:00:00.000Z");
    expect(shouldShowRecentlyUpdatedBadge(created, updated, now)).toBe(true);
  });

  it("returns false for invalid dates", () => {
    expect(shouldShowRecentlyUpdatedBadge("not-a-date", "2026-04-01T00:00:00.000Z")).toBe(false);
    expect(shouldShowRecentlyUpdatedBadge("2026-04-01T00:00:00.000Z", "bad")).toBe(false);
  });

  it("uses Date.now when nowMs omitted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T15:00:00.000Z"));
    expect(
      shouldShowRecentlyUpdatedBadge("2026-04-06T00:00:00.000Z", "2026-04-06T14:00:00.000Z"),
    ).toBe(true);
    vi.useRealTimers();
  });
});
