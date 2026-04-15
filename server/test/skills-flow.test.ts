import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSkillCreate = vi.fn();
const mockSkillFindMany = vi.fn();
const mockSkillCount = vi.fn();
const mockSkillFindFirst = vi.fn();
const mockSkillUpdate = vi.fn();

vi.mock("../src/middleware/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuthContext: () => ({ userId: 1, teamId: 1, role: "MEMBER" }),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    skill: {
      create: mockSkillCreate,
      findMany: mockSkillFindMany,
      count: mockSkillCount,
      findFirst: mockSkillFindFirst,
      update: mockSkillUpdate,
    },
  },
}));

async function buildSkillsApp() {
  const { skillsRouter } = await import("../src/routes/skills");
  const app = express();
  app.use(express.json());
  app.use("/api/skills", skillsRouter);
  return app;
}

describe("skills API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a skill", async () => {
    const app = await buildSkillsApp();
    mockSkillCreate.mockResolvedValue({
      id: 3,
      teamId: 1,
      ownerId: 1,
      title: "My Skill",
      summary: "S",
      body: "# Body",
      visibility: "PUBLIC",
      status: "DRAFT",
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 1, name: "U", avatarUrl: null },
    });

    const response = await request(app).post("/api/skills").send({
      title: "My Skill",
      summary: "S",
      body: "# Body",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.title).toBe("My Skill");
    expect(mockSkillCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ teamId: 1, ownerId: 1, title: "My Skill" }),
      }),
    );
  });

  it("lists skills with pagination meta", async () => {
    const app = await buildSkillsApp();
    mockSkillFindMany.mockResolvedValue([
      {
        id: 1,
        title: "A",
        summary: null,
        body: "x",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: { id: 1, name: "U", avatarUrl: null },
      },
    ]);
    mockSkillCount.mockResolvedValue(1);

    const response = await request(app).get("/api/skills").query({ page: 1, pageSize: 20 });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.total).toBe(1);
    expect(response.body.meta.totalPages).toBe(1);
  });

  it("updates a skill with PATCH", async () => {
    const app = await buildSkillsApp();
    mockSkillFindFirst.mockResolvedValue({ id: 2, teamId: 1, ownerId: 1, body: "old" });
    mockSkillUpdate.mockResolvedValue({
      id: 2,
      title: "T2",
      summary: null,
      body: "new",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 1, name: "U", avatarUrl: null },
    });

    const response = await request(app).patch("/api/skills/2").send({ body: "new" });

    expect(response.status).toBe(200);
    expect(response.body.data.body).toBe("new");
  });
});
