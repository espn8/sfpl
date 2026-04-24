import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCollectionFindFirst = vi.fn();
const mockPromptFindFirst = vi.fn();
const mockCollectionPromptAggregate = vi.fn();
const mockCollectionPromptUpsert = vi.fn();
const mockCollectionPromptFindFirst = vi.fn();
const mockCollectionPromptDelete = vi.fn();

vi.mock("../src/middleware/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOnboardingComplete: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireWriteAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuthContext: () => ({ userId: 1, teamId: 1, role: "MEMBER" }),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    collection: {
      findFirst: mockCollectionFindFirst,
    },
    prompt: {
      findFirst: mockPromptFindFirst,
    },
    collectionPrompt: {
      aggregate: mockCollectionPromptAggregate,
      upsert: mockCollectionPromptUpsert,
      findFirst: mockCollectionPromptFindFirst,
      delete: mockCollectionPromptDelete,
    },
  },
}));

async function buildCollectionsApp() {
  const { collectionsRouter } = await import("../src/routes/collections");
  const app = express();
  app.use(express.json());
  app.use("/api/collections", collectionsRouter);
  return app;
}

describe("collection membership edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when adding prompt and collection is missing", async () => {
    const app = await buildCollectionsApp();
    mockCollectionFindFirst.mockResolvedValue(null);
    mockPromptFindFirst.mockResolvedValue({ id: 2 });

    const response = await request(app).post("/api/collections/1/prompts/2");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("adds prompt membership with incremented sort order", async () => {
    const app = await buildCollectionsApp();
    mockCollectionFindFirst.mockResolvedValue({ id: 1 });
    mockPromptFindFirst.mockResolvedValue({ id: 2 });
    mockCollectionPromptAggregate.mockResolvedValue({ _max: { sortOrder: 3 } });
    mockCollectionPromptUpsert.mockResolvedValue({ collectionId: 1, promptId: 2, sortOrder: 4 });

    const response = await request(app).post("/api/collections/1/prompts/2");

    expect(response.status).toBe(200);
    expect(mockCollectionPromptUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sortOrder: 4,
        }),
      }),
    );
  });

  it("returns 404 when deleting non-existent membership", async () => {
    const app = await buildCollectionsApp();
    mockCollectionPromptFindFirst.mockResolvedValue(null);

    const response = await request(app).delete("/api/collections/1/prompts/2");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("deletes existing prompt membership", async () => {
    const app = await buildCollectionsApp();
    mockCollectionPromptFindFirst.mockResolvedValue({ collectionId: 1, promptId: 2 });
    mockCollectionPromptDelete.mockResolvedValue({ collectionId: 1, promptId: 2 });

    const response = await request(app).delete("/api/collections/1/prompts/2");

    expect(response.status).toBe(200);
    expect(mockCollectionPromptDelete).toHaveBeenCalledWith({
      where: { collectionId_promptId: { collectionId: 1, promptId: 2 } },
    });
  });
});
