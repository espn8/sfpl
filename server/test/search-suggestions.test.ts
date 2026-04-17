import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPromptFindMany = vi.fn();
const mockSkillFindMany = vi.fn();
const mockContextFindMany = vi.fn();

vi.mock("../src/middleware/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuthContext: () => ({ userId: 1, teamId: 1, role: "MEMBER", userOu: "engineering" }),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    prompt: {
      findMany: mockPromptFindMany,
    },
    skill: {
      findMany: mockSkillFindMany,
    },
    contextDocument: {
      findMany: mockContextFindMany,
    },
  },
}));

async function buildSearchApp() {
  const { searchRouter } = await import("../src/routes/search");
  const app = express();
  app.use(express.json());
  app.use("/api/search", searchRouter);
  return app;
}

describe("search suggestions endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when query is missing", async () => {
    const app = await buildSearchApp();
    const response = await request(app).get("/api/search/suggestions");
    expect(response.status).toBe(400);
  });

  it("returns 400 when query is empty", async () => {
    const app = await buildSearchApp();
    const response = await request(app).get("/api/search/suggestions?q=");
    expect(response.status).toBe(400);
  });

  it("returns matching filter suggestions", async () => {
    const app = await buildSearchApp();
    mockPromptFindMany.mockResolvedValue([]);
    mockSkillFindMany.mockResolvedValue([]);
    mockContextFindMany.mockResolvedValue([]);

    const response = await request(app).get("/api/search/suggestions?q=cursor");
    expect(response.status).toBe(200);
    expect(response.body.filters).toContainEqual({
      type: "filter",
      filterKey: "tool",
      filterValue: "cursor",
      label: "Tool: Cursor",
    });
  });

  it("returns matching asset suggestions", async () => {
    const app = await buildSearchApp();
    mockPromptFindMany.mockResolvedValue([
      { id: 1, title: "Code Review Prompt", tools: ["cursor"] },
    ]);
    mockSkillFindMany.mockResolvedValue([
      { id: 2, title: "Code Review Skill", tools: ["claude_code"] },
    ]);
    mockContextFindMany.mockResolvedValue([]);

    const response = await request(app).get("/api/search/suggestions?q=code");
    expect(response.status).toBe(200);
    expect(response.body.assets).toHaveLength(2);
    expect(response.body.assets[0]).toMatchObject({
      type: "asset",
      id: 1,
      assetType: "prompt",
      title: "Code Review Prompt",
      tool: "cursor",
    });
  });

  it("returns asset type filter suggestions", async () => {
    const app = await buildSearchApp();
    mockPromptFindMany.mockResolvedValue([]);
    mockSkillFindMany.mockResolvedValue([]);
    mockContextFindMany.mockResolvedValue([]);

    const response = await request(app).get("/api/search/suggestions?q=prompt");
    expect(response.status).toBe(200);
    expect(response.body.filters).toContainEqual({
      type: "filter",
      filterKey: "assetType",
      filterValue: "prompt",
      label: "Type: Prompts",
    });
  });

  it("respects limit parameter", async () => {
    const app = await buildSearchApp();
    mockPromptFindMany.mockResolvedValue([
      { id: 1, title: "Test 1", tools: [] },
      { id: 2, title: "Test 2", tools: [] },
      { id: 3, title: "Test 3", tools: [] },
    ]);
    mockSkillFindMany.mockResolvedValue([]);
    mockContextFindMany.mockResolvedValue([]);

    const response = await request(app).get("/api/search/suggestions?q=test&limit=2");
    expect(response.status).toBe(200);
    expect(response.body.assets.length).toBeLessThanOrEqual(2);
  });
});
