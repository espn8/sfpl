import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPrismaMock } from "./helpers/mockPrisma";

const prismaMock = buildPrismaMock();

vi.mock("../src/middleware/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOnboardingComplete: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireWriteAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuthContext: () => ({ userId: 1, teamId: 1, role: "MEMBER" }),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: prismaMock,
}));

async function buildContextApp() {
  const { contextRouter } = await import("../src/routes/context");
  const app = express();
  app.use(express.json());
  app.use("/api/context", contextRouter);
  return app;
}

const contextDocument = prismaMock.contextDocument as Record<string, ReturnType<typeof vi.fn>>;
const tag = prismaMock.tag as Record<string, ReturnType<typeof vi.fn>>;
const contextTag = prismaMock.contextTag as Record<string, ReturnType<typeof vi.fn>>;

describe("context API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a context document", async () => {
    const app = await buildContextApp();
    contextDocument.create.mockResolvedValue({
      id: 5,
      teamId: 1,
      ownerId: 1,
      title: "Rules",
      summary: null,
      body: "# Rules\n\nBe kind.",
      visibility: "PUBLIC",
      status: "DRAFT",
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 1, name: "U", avatarUrl: null },
    });
    contextDocument.findUnique.mockResolvedValue({
      id: 5,
      teamId: 1,
      ownerId: 1,
      title: "Rules",
      summary: null,
      body: "# Rules\n\nBe kind.",
      titleNormalized: "rules",
      bodyHash: "hash",
      supportUrl: null,
      visibility: "PUBLIC",
      status: "DRAFT",
      tools: [] as string[],
      modality: "TEXT",
      thumbnailUrl: null,
      thumbnailStatus: "PENDING",
      thumbnailError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 1, name: "U", avatarUrl: null },
      variables: [] as { id: number; key: string; label: string | null; defaultValue: string | null; required: boolean }[],
      contextTags: [] as { tag: { name: string } }[],
    });
    tag.count.mockResolvedValue(1);
    contextTag.createMany.mockResolvedValue({ count: 1 });

    const response = await request(app).post("/api/context").send({
      title: "Rules",
      body: "# Rules\n\nBe kind.",
      tagIds: [1],
    });

    expect(response.status).toBe(201);
    expect(response.body.data.title).toBe("Rules");
    expect(contextDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ teamId: 1, ownerId: 1 }),
      }),
    );
  });

  it("lists context documents", async () => {
    const app = await buildContextApp();
    contextDocument.findMany.mockResolvedValue([]);
    contextDocument.count.mockResolvedValue(0);

    const response = await request(app).get("/api/context");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.total).toBe(0);
  });

  it("archives with DELETE", async () => {
    const app = await buildContextApp();
    contextDocument.findUnique.mockResolvedValue({ id: 9, teamId: 1, ownerId: 1 });
    const archived = {
      id: 9,
      status: "ARCHIVED",
      teamId: 1,
      ownerId: 1,
      title: "T",
      summary: null,
      body: "b",
      visibility: "PUBLIC",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    contextDocument.update.mockResolvedValue(archived);
    contextDocument.findUnique.mockResolvedValue(archived);

    const response = await request(app).delete("/api/context/9");

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("ARCHIVED");
  });
});
