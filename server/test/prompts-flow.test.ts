import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPrismaMock } from "./helpers/mockPrisma";

const mockGeneratePromptThumbnail = vi.fn();

const prismaMock = buildPrismaMock();

vi.mock("../src/middleware/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireWriteAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuthContext: () => ({ userId: 1, teamId: 1, role: "MEMBER" }),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("../src/services/nanoBanana", () => ({
  generatePromptThumbnail: mockGeneratePromptThumbnail,
}));

async function buildPromptsApp() {
  const { promptsRouter } = await import("../src/routes/prompts");
  const app = express();
  app.use(express.json());
  app.use("/api/prompts", promptsRouter);
  return app;
}

// Convenience accessors — these go through the proxy, so any method we
// reference is automatically a vi.fn() with a sensible resolved-value default.
const prompt = prismaMock.prompt as Record<string, ReturnType<typeof vi.fn>>;
const promptVersion = prismaMock.promptVersion as Record<string, ReturnType<typeof vi.fn>>;
const promptVariable = prismaMock.promptVariable as Record<string, ReturnType<typeof vi.fn>>;
const tag = prismaMock.tag as Record<string, ReturnType<typeof vi.fn>>;
const promptTag = prismaMock.promptTag as Record<string, ReturnType<typeof vi.fn>>;
const prismaTransaction = (prismaMock as unknown as { $transaction: ReturnType<typeof vi.fn> }).$transaction;

describe("prompts create/update/restore flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a prompt and initial version", async () => {
    const app = await buildPromptsApp();
    prompt.create.mockResolvedValue({
      id: 10,
      title: "A",
      body: "B",
      summary: null,
      tools: ["cursor"],
      modality: "TEXT",
      modelHint: null,
      thumbnailStatus: "PENDING",
    });
    prompt.findUnique.mockResolvedValue({ id: 10, title: "A", summary: null, body: "B" });
    mockGeneratePromptThumbnail.mockResolvedValue("https://example.com/thumb.png");
    prompt.update.mockResolvedValue({ id: 10 });

    const response = await request(app).post("/api/prompts").send({
      title: "A",
      body: "B",
      tools: ["cursor"],
      modality: "text",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.thumbnailStatus).toBe("PENDING");
    expect(prompt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          teamId: 1,
          ownerId: 1,
          versions: expect.any(Object),
        }),
      }),
    );
  });

  it("updates prompt and creates a new version when body changes", async () => {
    const app = await buildPromptsApp();
    prompt.findFirst.mockResolvedValueOnce({
      id: 5,
      teamId: 1,
      ownerId: 1,
      title: "Existing Prompt",
      body: "old-body",
      tools: ["cursor"],
      status: "DRAFT",
    });
    prompt.update.mockResolvedValue({
      id: 5,
      body: "new-body",
      tools: ["cursor"],
      modality: "TEXT",
      modelHint: null,
    });
    promptVersion.findFirst.mockResolvedValue({ version: 2 });
    promptVersion.create.mockResolvedValue({ id: 99 });

    const response = await request(app).patch("/api/prompts/5").send({
      body: "new-body",
      changelog: "updated",
    });

    expect(response.status).toBe(200);
    expect(promptVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptId: 5,
          version: 3,
          body: "new-body",
        }),
      }),
    );
  });

  it("replaces prompt tags when tagIds is sent", async () => {
    const app = await buildPromptsApp();
    prompt.findFirst
      .mockResolvedValueOnce({ id: 12, teamId: 1, ownerId: 1, body: "body" })
      .mockResolvedValueOnce({
        id: 12,
        teamId: 1,
        ownerId: 1,
        title: "T",
        body: "body",
        summary: null,
        tools: ["cursor"],
        modality: "TEXT",
        modelHint: null,
        visibility: "PUBLIC",
        thumbnailStatus: "PENDING",
        promptTags: [{ tag: { id: 2, name: "alpha" } }],
        variables: [],
        ratings: [],
        _count: { favorites: 0, usageEvents: 0 },
      });
    prompt.update.mockResolvedValue({
      id: 12,
      body: "body",
      tools: ["cursor"],
      modality: "TEXT",
      modelHint: null,
      thumbnailStatus: "PENDING",
      promptTags: [],
      variables: [],
      ratings: [],
      _count: { favorites: 0, usageEvents: 0 },
    });
    tag.findMany.mockResolvedValue([{ id: 2 }, { id: 3 }]);
    prismaTransaction.mockResolvedValue(undefined);

    const response = await request(app).patch("/api/prompts/12").send({ tagIds: [2, 3] });

    expect(response.status).toBe(200);
    expect(tag.findMany).toHaveBeenCalledWith({
      where: { id: { in: [2, 3] }, teamId: 1 },
      select: { id: true },
    });
    expect(prismaTransaction).toHaveBeenCalled();
    expect(promptTag.deleteMany).toHaveBeenCalledWith({ where: { promptId: 12 } });
    expect(promptTag.createMany).toHaveBeenCalledWith({
      data: [
        { promptId: 12, tagId: 2 },
        { promptId: 12, tagId: 3 },
      ],
    });
  });

  it("restores a prompt from target version", async () => {
    const app = await buildPromptsApp();
    prompt.findFirst.mockResolvedValueOnce({ id: 6, teamId: 1, ownerId: 1, body: "current-body" });
    promptVersion.findFirst.mockResolvedValueOnce({ id: 1, promptId: 6, version: 1, body: "restored-body" });
    prompt.update.mockResolvedValue({ id: 6, body: "restored-body" });

    const response = await request(app).post("/api/prompts/6/restore/1");

    expect(response.status).toBe(200);
    expect(prompt.update).toHaveBeenCalledWith({
      where: { id: 6 },
      data: { body: "restored-body" },
    });
  });

  it("creates an explicit prompt version and updates prompt body", async () => {
    const app = await buildPromptsApp();
    prompt.findFirst.mockResolvedValueOnce({ id: 8, teamId: 1, ownerId: 1, body: "old" });
    promptVersion.findFirst.mockResolvedValueOnce({ version: 4 });
    prompt.update.mockResolvedValueOnce({
      id: 8,
      body: "new-version-body",
      tools: ["cursor"],
      modality: "TEXT",
      modelHint: null,
      thumbnailStatus: "PENDING",
    });
    promptVersion.create.mockResolvedValueOnce({ id: 200, version: 5 });

    const response = await request(app).post("/api/prompts/8/versions").send({
      body: "new-version-body",
      changelog: "added clearer instructions",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.latestVersion).toBe(5);
    expect(prompt.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { body: "new-version-body" },
    });
    expect(promptVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptId: 8,
          version: 5,
          body: "new-version-body",
          createdById: 1,
          changelog: "added clearer instructions",
        }),
      }),
    );
  });

  it("requeues thumbnail generation from regenerate endpoint", async () => {
    const app = await buildPromptsApp();
    prompt.findFirst.mockResolvedValueOnce({
      id: 7,
      teamId: 1,
      ownerId: 1,
      body: "body",
      tools: ["cursor"],
      modality: "TEXT",
      modelHint: null,
      thumbnailStatus: "FAILED",
    });
    prompt.update.mockResolvedValueOnce({
      id: 7,
      body: "body",
      tools: ["cursor"],
      modality: "TEXT",
      modelHint: null,
      thumbnailStatus: "PENDING",
    });
    prompt.findUnique.mockResolvedValueOnce({ id: 7, title: "T", summary: null, body: "body" });
    mockGeneratePromptThumbnail.mockResolvedValueOnce("https://example.com/new.png");
    prompt.update.mockResolvedValueOnce({ id: 7 });

    const response = await request(app).post("/api/prompts/7/regenerate-thumbnail");

    expect(response.status).toBe(202);
    expect(prompt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({
          thumbnailStatus: "PENDING",
        }),
      }),
    );
  });

  it("replaces prompt variables", async () => {
    const app = await buildPromptsApp();
    prompt.findFirst
      .mockResolvedValueOnce({ id: 9, teamId: 1, ownerId: 1, body: "x", visibility: "PUBLIC" })
      .mockResolvedValueOnce({
        id: 9,
        teamId: 1,
        ownerId: 1,
        title: "T",
        body: "Hello [NAME]",
        summary: null,
        tools: ["cursor"],
        modality: "TEXT",
        modelHint: null,
        visibility: "PUBLIC",
        thumbnailStatus: "PENDING",
        promptTags: [],
        variables: [{ id: 1, promptId: 9, key: "NAME", label: "Name", defaultValue: "there", required: false }],
        ratings: [],
        _count: { favorites: 0, usageEvents: 0 },
      });
    prismaTransaction.mockResolvedValue(undefined);

    const response = await request(app)
      .put("/api/prompts/9/variables")
      .send({ variables: [{ key: "NAME", label: "Name", defaultValue: "friend", required: true }] });

    expect(response.status).toBe(200);
    expect(prismaTransaction).toHaveBeenCalled();
    expect(promptVariable.deleteMany).toHaveBeenCalledWith({ where: { promptId: 9 } });
    expect(promptVariable.createMany).toHaveBeenCalledWith({
      data: [
        {
          promptId: 9,
          key: "NAME",
          label: "Name",
          defaultValue: "friend",
          required: true,
        },
      ],
    });
  });
});
