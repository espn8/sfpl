import session from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPromptFindMany = vi.fn();
const mockSkillFindMany = vi.fn();
const mockContextFindMany = vi.fn();
const mockBuildFindMany = vi.fn();

const mockPromptCount = vi.fn();
const mockSkillCount = vi.fn();
const mockContextCount = vi.fn();
const mockBuildCount = vi.fn();
const mockUserCount = vi.fn();
const mockUsageEventCount = vi.fn();

const noopGroupBy = vi.fn().mockResolvedValue([]);
const noopFindMany = vi.fn().mockResolvedValue([]);

vi.mock("../src/middleware/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOnboardingComplete: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireWriteAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuthContext: () => ({ userId: 1, teamId: 1, role: "MEMBER", userOu: null }),
}));

vi.mock("../src/lib/visibility", () => ({
  buildVisibilityWhereFragment: () => ({ OR: [{ teamId: 1 }] }),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    prompt: {
      findMany: mockPromptFindMany,
      count: mockPromptCount,
    },
    skill: {
      findMany: mockSkillFindMany,
      count: mockSkillCount,
    },
    contextDocument: {
      findMany: mockContextFindMany,
      count: mockContextCount,
    },
    build: {
      findMany: mockBuildFindMany,
      count: mockBuildCount,
    },
    usageEvent: {
      groupBy: noopGroupBy,
      count: mockUsageEventCount,
    },
    skillUsageEvent: { groupBy: noopGroupBy, count: vi.fn().mockResolvedValue(0) },
    contextUsageEvent: { groupBy: noopGroupBy, count: vi.fn().mockResolvedValue(0) },
    buildUsageEvent: { groupBy: noopGroupBy, count: vi.fn().mockResolvedValue(0) },
    favorite: { findMany: noopFindMany, groupBy: noopGroupBy },
    skillFavorite: { findMany: noopFindMany, groupBy: noopGroupBy },
    contextFavorite: { findMany: noopFindMany, groupBy: noopGroupBy },
    buildFavorite: { findMany: noopFindMany, groupBy: noopGroupBy },
    rating: { findMany: noopFindMany },
    skillRating: { findMany: noopFindMany, groupBy: noopGroupBy },
    contextRating: { findMany: noopFindMany, groupBy: noopGroupBy },
    buildRating: { findMany: noopFindMany, groupBy: noopGroupBy },
    user: { count: mockUserCount },
  },
}));

const basePrompt = {
  id: 101,
  title: "Big Prompt",
  summary: "A short summary",
  status: "PUBLISHED",
  visibility: "TEAM",
  modelHint: null,
  tools: ["cursor"],
  modality: "TEXT",
  thumbnailUrl: null,
  thumbnailStatus: "READY",
  isSmartPick: false,
  usageCount: 7,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-02-01T00:00:00Z"),
  owner: { id: 1, name: "A", avatarUrl: null },
  variables: [],
  ratings: [],
};

const baseContext = {
  id: 201,
  title: "Big Context",
  summary: "Short ctx summary",
  status: "PUBLISHED",
  visibility: "TEAM",
  tools: [],
  thumbnailUrl: null,
  thumbnailStatus: "READY",
  isSmartPick: false,
  usageCount: 3,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-02-01T00:00:00Z"),
  owner: { id: 1, name: "A", avatarUrl: null },
  variables: [],
};

const baseBuild = {
  id: 301,
  title: "Build One",
  summary: "Build summary",
  buildUrl: "https://example.com/build",
  supportUrl: null,
  status: "PUBLISHED",
  visibility: "TEAM",
  thumbnailUrl: null,
  thumbnailStatus: "READY",
  isSmartPick: false,
  usageCount: 5,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-02-01T00:00:00Z"),
  owner: { id: 1, name: "A", avatarUrl: null },
};

describe("GET /api/assets payload shape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPromptFindMany.mockResolvedValue([basePrompt]);
    mockSkillFindMany.mockResolvedValue([]);
    mockContextFindMany.mockResolvedValue([baseContext]);
    mockBuildFindMany.mockResolvedValue([baseBuild]);
    mockPromptCount.mockResolvedValue(1);
    mockSkillCount.mockResolvedValue(0);
    mockContextCount.mockResolvedValue(1);
    mockBuildCount.mockResolvedValue(1);
    mockUserCount.mockResolvedValue(3);
    mockUsageEventCount.mockResolvedValue(0);
  });

  it("never selects body from the prompt table (Phase 2: lazy body fetch)", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/api/assets?sort=recent");
    expect(response.status).toBe(200);

    const selectArg = mockPromptFindMany.mock.calls[0]?.[0]?.select as
      | Record<string, unknown>
      | undefined;
    expect(selectArg).toBeDefined();
    expect(selectArg?.body).toBeUndefined();
    expect(selectArg?.title).toBe(true);
    expect(selectArg?.summary).toBe(true);
  });

  it("never selects body from the contextDocument table", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/api/assets?sort=recent");
    expect(response.status).toBe(200);

    const selectArg = mockContextFindMany.mock.calls[0]?.[0]?.select as
      | Record<string, unknown>
      | undefined;
    expect(selectArg).toBeDefined();
    expect(selectArg?.body).toBeUndefined();
  });

  it("omits body from prompt and context entries in the JSON response", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/api/assets?sort=recent");
    expect(response.status).toBe(200);

    const promptEntry = response.body.data.find(
      (a: { assetType: string }) => a.assetType === "prompt",
    );
    const contextEntry = response.body.data.find(
      (a: { assetType: string }) => a.assetType === "context",
    );
    const buildEntry = response.body.data.find(
      (a: { assetType: string }) => a.assetType === "build",
    );

    expect(promptEntry).toBeDefined();
    expect("body" in promptEntry).toBe(false);

    expect(contextEntry).toBeDefined();
    expect("body" in contextEntry).toBe(false);

    expect(buildEntry).toBeDefined();
    expect(buildEntry.body).toBe("https://example.com/build");
  });

  it("never selects thumbnailUrl from any table (Phase 2b: lazy thumbnail fetch)", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/api/assets?sort=recent");
    expect(response.status).toBe(200);

    const promptSelect = mockPromptFindMany.mock.calls[0]?.[0]?.select as Record<string, unknown> | undefined;
    const contextSelect = mockContextFindMany.mock.calls[0]?.[0]?.select as Record<string, unknown> | undefined;
    const buildSelect = mockBuildFindMany.mock.calls[0]?.[0]?.select as Record<string, unknown> | undefined;

    expect(promptSelect?.thumbnailUrl).toBeUndefined();
    expect(contextSelect?.thumbnailUrl).toBeUndefined();
    expect(buildSelect?.thumbnailUrl).toBeUndefined();
    // Status is still selected as the cheap "exists" signal.
    expect(promptSelect?.thumbnailStatus).toBe(true);
    expect(contextSelect?.thumbnailStatus).toBe(true);
    expect(buildSelect?.thumbnailStatus).toBe(true);
  });

  it("returns a short /api/thumbnails reference URL (never a data: URL) when the row is READY", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/api/assets?sort=recent");
    expect(response.status).toBe(200);

    for (const asset of response.body.data as Array<{
      id: number;
      assetType: string;
      thumbnailUrl: string | null;
    }>) {
      if (asset.thumbnailUrl === null) continue;
      expect(asset.thumbnailUrl.startsWith("data:")).toBe(false);
      expect(asset.thumbnailUrl).toMatch(/^\/api\/thumbnails\/(prompt|context|build|skill)\/\d+\?v=/);
    }

    const promptEntry = response.body.data.find((a: { assetType: string }) => a.assetType === "prompt");
    expect(promptEntry.thumbnailUrl).toMatch(/^\/api\/thumbnails\/prompt\/101\?v=/);
  });

  it("returns null thumbnailUrl when thumbnailStatus is not READY", async () => {
    mockPromptFindMany.mockResolvedValue([{ ...basePrompt, thumbnailStatus: "PENDING" }]);
    mockContextFindMany.mockResolvedValue([{ ...baseContext, thumbnailStatus: "FAILED" }]);
    mockBuildFindMany.mockResolvedValue([]);

    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/api/assets?sort=recent");
    expect(response.status).toBe(200);

    const promptEntry = response.body.data.find((a: { assetType: string }) => a.assetType === "prompt");
    const contextEntry = response.body.data.find((a: { assetType: string }) => a.assetType === "context");
    expect(promptEntry.thumbnailUrl).toBeNull();
    expect(contextEntry.thumbnailUrl).toBeNull();
  });

  // --- Phase 3: denormalized usageCount + accurate total + snapshot flag ---

  it("selects the denormalized usageCount column for every asset type (Phase 3)", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/api/assets?sort=recent");
    expect(response.status).toBe(200);

    const promptSelect = mockPromptFindMany.mock.calls[0]?.[0]?.select as Record<string, unknown> | undefined;
    const skillSelect = mockSkillFindMany.mock.calls[0]?.[0]?.select as Record<string, unknown> | undefined;
    const contextSelect = mockContextFindMany.mock.calls[0]?.[0]?.select as Record<string, unknown> | undefined;
    const buildSelect = mockBuildFindMany.mock.calls[0]?.[0]?.select as Record<string, unknown> | undefined;

    expect(promptSelect?.usageCount).toBe(true);
    expect(skillSelect?.usageCount).toBe(true);
    expect(contextSelect?.usageCount).toBe(true);
    expect(buildSelect?.usageCount).toBe(true);
  });

  it("uses orderBy: { usageCount: 'desc' } for sort=mostUsed on every type (Phase 3)", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/api/assets?sort=mostUsed");
    expect(response.status).toBe(200);

    const promptOrderBy = mockPromptFindMany.mock.calls[0]?.[0]?.orderBy;
    const skillOrderBy = mockSkillFindMany.mock.calls[0]?.[0]?.orderBy;
    const contextOrderBy = mockContextFindMany.mock.calls[0]?.[0]?.orderBy;
    const buildOrderBy = mockBuildFindMany.mock.calls[0]?.[0]?.orderBy;

    expect(promptOrderBy).toEqual({ usageCount: "desc" });
    expect(skillOrderBy).toEqual({ usageCount: "desc" });
    expect(contextOrderBy).toEqual({ usageCount: "desc" });
    expect(buildOrderBy).toEqual({ usageCount: "desc" });
  });

  it("echoes the denormalized usageCount from each row (no groupBy inferred)", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/api/assets?sort=recent");
    expect(response.status).toBe(200);

    const promptEntry = response.body.data.find((a: { assetType: string }) => a.assetType === "prompt");
    const contextEntry = response.body.data.find((a: { assetType: string }) => a.assetType === "context");
    const buildEntry = response.body.data.find((a: { assetType: string }) => a.assetType === "build");

    expect(promptEntry.usageCount).toBe(7);
    expect(contextEntry.usageCount).toBe(3);
    expect(buildEntry.usageCount).toBe(5);
  });

  it("returns meta.total as the sum of per-type counts, not the overfetched window", async () => {
    mockPromptCount.mockResolvedValue(41);
    mockSkillCount.mockResolvedValue(0);
    mockContextCount.mockResolvedValue(12);
    mockBuildCount.mockResolvedValue(7);

    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/api/assets?sort=recent&pageSize=10");
    expect(response.status).toBe(200);

    expect(response.body.meta.total).toBe(60);
    expect(response.body.meta.totalPages).toBe(6);
    expect(response.body.meta.facets.assetType).toEqual({
      prompt: 41,
      skill: 0,
      context: 12,
      build: 7,
    });
  });

  it("omits meta.snapshot and skips the snapshot queries when snapshot=false", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/api/assets?sort=mostUsed&snapshot=false");
    expect(response.status).toBe(200);

    expect(response.body.meta.snapshot).toBeUndefined();
    expect(mockUserCount).not.toHaveBeenCalled();
    expect(mockUsageEventCount).not.toHaveBeenCalled();
  });

  it("includes meta.snapshot by default (no snapshot param)", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/api/assets?sort=recent");
    expect(response.status).toBe(200);

    expect(response.body.meta.snapshot).toBeDefined();
    expect(mockUserCount).toHaveBeenCalledTimes(1);
  });

  it("includes owner display name in text search (q) for every asset type", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/api/assets?sort=recent&q=SomeName");
    expect(response.status).toBe(200);

    const expectOwnerInTextOr = (where: unknown) => {
      const w = where as { AND?: unknown[] };
      expect(w?.AND).toBeDefined();
      // Visibility uses AND[0].OR; text search is another AND entry whose OR includes title/summary/body.
      const textBlock = w!.AND!.find((clause) => {
        if (typeof clause !== "object" || clause === null || !("OR" in clause)) return false;
        const or = (clause as { OR: unknown[] }).OR;
        return or.some((item) => typeof item === "object" && item !== null && "title" in item);
      });
      expect(textBlock).toBeDefined();
      const or = (textBlock as { OR: Array<Record<string, unknown>> }).OR;
      expect(or).toContainEqual({
        owner: { name: { contains: "SomeName", mode: "insensitive" } },
      });
    };

    expectOwnerInTextOr(mockPromptFindMany.mock.calls[0]?.[0]?.where);
    expectOwnerInTextOr(mockSkillFindMany.mock.calls[0]?.[0]?.where);
    expectOwnerInTextOr(mockContextFindMany.mock.calls[0]?.[0]?.where);
    expectOwnerInTextOr(mockBuildFindMany.mock.calls[0]?.[0]?.where);
  });

  it("sets Cache-Control to private+max-age=30 for non-mine list responses", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/api/assets?sort=recent");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, max-age=30, must-revalidate");
  });

  it("sets Cache-Control to private+no-store for mine=true list responses", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/api/assets?sort=recent&mine=true");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });

  it("keeps response payload under 50 KB for a handful of heavy entries", async () => {
    const bigPrompt = {
      ...basePrompt,
      summary: "s",
    };
    mockPromptFindMany.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ ...bigPrompt, id: i + 1 })),
    );
    mockContextFindMany.mockResolvedValue([]);
    mockBuildFindMany.mockResolvedValue([]);
    mockPromptCount.mockResolvedValue(30);
    mockContextCount.mockResolvedValue(0);
    mockBuildCount.mockResolvedValue(0);

    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/api/assets?sort=recent");
    expect(response.status).toBe(200);

    const size = Buffer.byteLength(JSON.stringify(response.body), "utf8");
    expect(size).toBeLessThan(50 * 1024);
  });
});
