import session from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPromptFindMany = vi.fn();
const mockPromptCount = vi.fn();
const mockCollectionFindMany = vi.fn();
const mockCollectionCount = vi.fn();

vi.mock("../src/middleware/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuthContext: () => ({ userId: 1, teamId: 1, role: "MEMBER" }),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    prompt: {
      findMany: mockPromptFindMany,
      count: mockPromptCount,
    },
    collection: {
      findMany: mockCollectionFindMany,
      count: mockCollectionCount,
    },
  },
}));

describe("list endpoint pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("paginates prompts with defaults and meta", async () => {
    mockPromptFindMany.mockResolvedValue([]);
    mockPromptCount.mockResolvedValue(0);

    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });
    const response = await request(app).get("/api/prompts");

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
    });
    expect(mockPromptFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
      }),
    );
  });

  it("paginates prompts using page and pageSize", async () => {
    mockPromptFindMany.mockResolvedValue([]);
    mockPromptCount.mockResolvedValue(44);

    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });
    const response = await request(app).get("/api/prompts?page=2&pageSize=10");

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      page: 2,
      pageSize: 10,
      total: 44,
      totalPages: 5,
    });
    expect(mockPromptFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    );
  });

  it("returns 400 when prompts pageSize exceeds max", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });
    const response = await request(app).get("/api/prompts?pageSize=101");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });

  it("paginates collections and returns meta", async () => {
    mockCollectionFindMany.mockResolvedValue([]);
    mockCollectionCount.mockResolvedValue(7);

    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });
    const response = await request(app).get("/api/collections?page=1&pageSize=5");

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      page: 1,
      pageSize: 5,
      total: 7,
      totalPages: 2,
    });
    expect(mockCollectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 5,
      }),
    );
  });
});
