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
    skillUsageEvent: { groupBy: noopGroupBy },
    contextUsageEvent: { groupBy: noopGroupBy },
    buildUsageEvent: { groupBy: noopGroupBy },
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
