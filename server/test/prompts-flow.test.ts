import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPromptCreate = vi.fn();
const mockPromptFindFirst = vi.fn();
const mockPromptUpdate = vi.fn();
const mockPromptVersionFindFirst = vi.fn();
const mockPromptVersionCreate = vi.fn();

vi.mock("../src/middleware/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuthContext: () => ({ userId: 1, teamId: 1, role: "MEMBER" }),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    prompt: {
      create: mockPromptCreate,
      findFirst: mockPromptFindFirst,
      update: mockPromptUpdate,
    },
    promptVersion: {
      findFirst: mockPromptVersionFindFirst,
      create: mockPromptVersionCreate,
    },
  },
}));

async function buildPromptsApp() {
  const { promptsRouter } = await import("../src/routes/prompts");
  const app = express();
  app.use(express.json());
  app.use("/api/prompts", promptsRouter);
  return app;
}

describe("prompts create/update/restore flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a prompt and initial version", async () => {
    const app = await buildPromptsApp();
    mockPromptCreate.mockResolvedValue({ id: 10, title: "A", body: "B" });

    const response = await request(app).post("/api/prompts").send({
      title: "A",
      body: "B",
    });

    expect(response.status).toBe(201);
    expect(mockPromptCreate).toHaveBeenCalledWith(
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
    mockPromptFindFirst.mockResolvedValueOnce({ id: 5, teamId: 1, ownerId: 1, body: "old-body" });
    mockPromptUpdate.mockResolvedValue({ id: 5, body: "new-body" });
    mockPromptVersionFindFirst.mockResolvedValue({ version: 2 });
    mockPromptVersionCreate.mockResolvedValue({ id: 99 });

    const response = await request(app).patch("/api/prompts/5").send({
      body: "new-body",
      changelog: "updated",
    });

    expect(response.status).toBe(200);
    expect(mockPromptVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptId: 5,
          version: 3,
          body: "new-body",
        }),
      }),
    );
  });

  it("restores a prompt from target version", async () => {
    const app = await buildPromptsApp();
    mockPromptFindFirst.mockResolvedValueOnce({ id: 6, teamId: 1, ownerId: 1, body: "current-body" });
    mockPromptVersionFindFirst.mockResolvedValueOnce({ id: 1, promptId: 6, version: 1, body: "restored-body" });
    mockPromptUpdate.mockResolvedValue({ id: 6, body: "restored-body" });

    const response = await request(app).post("/api/prompts/6/restore/1");

    expect(response.status).toBe(200);
    expect(mockPromptUpdate).toHaveBeenCalledWith({
      where: { id: 6 },
      data: { body: "restored-body" },
    });
  });
});
