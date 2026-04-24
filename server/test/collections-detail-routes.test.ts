import { Prisma } from "@prisma/client";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCollectionFindFirst = vi.fn();
const mockCollectionDelete = vi.fn();
const mockCollectionUpdate = vi.fn();
const mockCollectionCreate = vi.fn();
const mockGetAuthContext = vi.fn();

vi.mock("../src/middleware/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOnboardingComplete: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireWriteAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuthContext: () => mockGetAuthContext(),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    collection: {
      findFirst: mockCollectionFindFirst,
      delete: mockCollectionDelete,
      update: mockCollectionUpdate,
      create: mockCollectionCreate,
    },
    prompt: {
      findFirst: vi.fn(),
    },
    collectionPrompt: {
      aggregate: vi.fn(),
      upsert: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
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

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.19.3",
  });
}

describe("collections detail routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthContext.mockReturnValue({ userId: 1, teamId: 1, role: "MEMBER" });
  });

  it("returns collection detail for team-scoped id", async () => {
    const app = await buildCollectionsApp();
    mockCollectionFindFirst.mockResolvedValue({
      id: 5,
      name: "Ops",
      description: null,
      prompts: [],
    });

    const response = await request(app).get("/api/collections/5");

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(5);
    expect(mockCollectionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5, teamId: 1 },
      }),
    );
  });

  it("returns 403 when non-owner/admin deletes another creator collection", async () => {
    const app = await buildCollectionsApp();
    mockCollectionFindFirst.mockResolvedValue({ id: 7, createdById: 2, isSystem: false });

    const response = await request(app).delete("/api/collections/7");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(mockCollectionDelete).not.toHaveBeenCalled();
  });

  it("deletes collection for owner role", async () => {
    const app = await buildCollectionsApp();
    mockGetAuthContext.mockReturnValue({ userId: 99, teamId: 1, role: "OWNER" });
    mockCollectionFindFirst.mockResolvedValue({ id: 7, createdById: 2, isSystem: false });
    mockCollectionDelete.mockResolvedValue({ id: 7 });

    const response = await request(app).delete("/api/collections/7");

    expect(response.status).toBe(200);
    expect(response.body.data.ok).toBe(true);
    expect(mockCollectionDelete).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it("returns conflict when update hits unique collection name", async () => {
    const app = await buildCollectionsApp();
    mockCollectionFindFirst.mockResolvedValue({ id: 4, createdById: 1 });
    mockCollectionUpdate.mockRejectedValue(uniqueConstraintError());

    const response = await request(app).patch("/api/collections/4").send({ name: "Duplicate" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });

  it("returns conflict when create hits unique collection name", async () => {
    const app = await buildCollectionsApp();
    mockCollectionCreate.mockRejectedValue(uniqueConstraintError());

    const response = await request(app).post("/api/collections").send({ name: "Duplicate" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });
});
