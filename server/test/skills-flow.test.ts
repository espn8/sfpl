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

async function buildSkillsApp() {
  const { skillsRouter } = await import("../src/routes/skills");
  const app = express();
  app.use(express.json());
  app.use("/api/skills", skillsRouter);
  return app;
}

const skill = prismaMock.skill as Record<string, ReturnType<typeof vi.fn>>;
const skillVersion = prismaMock.skillVersion as Record<string, ReturnType<typeof vi.fn>>;

describe("skills API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a skill", async () => {
    const app = await buildSkillsApp();
    const createdRow = {
      id: 3,
      teamId: 1,
      ownerId: 1,
      title: "My Skill",
      summary: "S",
      skillUrl: "https://example.com/skill.zip",
      skillUrlNormalized: "https://example.com/skill.zip",
      supportUrl: null,
      visibility: "PUBLIC",
      status: "DRAFT",
      tools: [] as string[],
      thumbnailUrl: null,
      thumbnailStatus: "PENDING",
      thumbnailError: null,
      isSmartPick: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 1, name: "U", avatarUrl: null },
      skillTags: [] as { tag: { name: string } }[],
    };
    skill.create.mockResolvedValue({
      id: 3,
      teamId: 1,
      ownerId: 1,
      title: "My Skill",
      summary: "S",
      skillUrl: "https://example.com/skill.zip",
      visibility: "PUBLIC",
      status: "DRAFT",
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 1, name: "U", avatarUrl: null },
    });
    skill.findUnique.mockResolvedValue(createdRow);

    const response = await request(app).post("/api/skills").send({
      title: "My Skill",
      summary: "S",
      skillUrl: "https://example.com/skill.zip",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.title).toBe("My Skill");
    expect(skill.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ teamId: 1, ownerId: 1, title: "My Skill" }),
      }),
    );
  });

  it("creates a skill with a Salesforce enterprise Slack skill URL", async () => {
    const app = await buildSkillsApp();
    const slackSkillUrl = "https://salesforce.enterprise.slack.com/docs/T5J4Q04QG/F01234ABCDE";
    const createdRow = {
      id: 4,
      teamId: 1,
      ownerId: 1,
      title: "Slack Skill",
      summary: null,
      skillUrl: slackSkillUrl,
      skillUrlNormalized: slackSkillUrl,
      supportUrl: null,
      visibility: "PUBLIC",
      status: "DRAFT",
      tools: [] as string[],
      thumbnailUrl: null,
      thumbnailStatus: "PENDING",
      thumbnailError: null,
      isSmartPick: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 1, name: "U", avatarUrl: null },
      skillTags: [] as { tag: { name: string } }[],
    };
    skill.create.mockResolvedValue({
      id: 4,
      teamId: 1,
      ownerId: 1,
      title: "Slack Skill",
      summary: null,
      skillUrl: slackSkillUrl,
      visibility: "PUBLIC",
      status: "DRAFT",
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 1, name: "U", avatarUrl: null },
    });
    skill.findUnique.mockResolvedValue(createdRow);

    const response = await request(app).post("/api/skills").send({
      title: "Slack Skill",
      skillUrl: slackSkillUrl,
    });

    expect(response.status).toBe(201);
    expect(skill.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ skillUrl: slackSkillUrl }),
      }),
    );
  });

  it("rejects skillUrl that is neither an archive nor a Slack enterprise skill link", async () => {
    const app = await buildSkillsApp();

    const response = await request(app).post("/api/skills").send({
      title: "Bad",
      skillUrl: "https://example.com/readme.md",
    });

    expect(response.status).toBe(400);
    expect(skill.create).not.toHaveBeenCalled();
  });

  it("lists skills with pagination meta", async () => {
    const app = await buildSkillsApp();
    skill.findMany.mockResolvedValue([
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
        skillTags: [] as { tag: { name: string } }[],
      },
    ]);
    skill.count.mockResolvedValue(1);

    const response = await request(app).get("/api/skills").query({ page: 1, pageSize: 20 });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.total).toBe(1);
    expect(response.body.meta.totalPages).toBe(1);
  });

  it("updates a skill with PATCH", async () => {
    const app = await buildSkillsApp();
    const existing = {
      id: 2,
      teamId: 1,
      ownerId: 1,
      title: "Old",
      summary: null,
      skillUrl: "https://example.com/skill.zip",
      supportUrl: null,
      visibility: "PUBLIC",
      status: "PUBLISHED",
      tools: [] as string[],
    };
    const afterPatch = {
      id: 2,
      teamId: 1,
      ownerId: 1,
      title: "T2",
      summary: "Updated summary",
      skillUrl: "https://example.com/skill.zip",
      skillUrlNormalized: "https://example.com/skill.zip",
      supportUrl: null,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      tools: [] as string[],
      thumbnailUrl: null,
      thumbnailStatus: "PENDING",
      thumbnailError: null,
      isSmartPick: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 1, name: "U", avatarUrl: null },
      skillTags: [] as { tag: { name: string } }[],
    };
    skill.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce(afterPatch);
    skillVersion.findFirst.mockResolvedValue({ version: 1 });
    skillVersion.create.mockResolvedValue({ id: 111, version: 2 });
    skill.update.mockResolvedValue({
      id: 2,
      title: "T2",
      summary: "Updated summary",
      skillUrl: "https://example.com/skill.zip",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 1, name: "U", avatarUrl: null },
    });

    const response = await request(app).patch("/api/skills/2").send({ summary: "Updated summary" });

    expect(response.status).toBe(200);
    expect(response.body.data.summary).toBe("Updated summary");
  });
});
