import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPromptFindUnique = vi.fn();
const mockContextFindUnique = vi.fn();
const mockBuildFindUnique = vi.fn();
const mockSkillFindUnique = vi.fn();

vi.mock("../src/middleware/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuthContext: () => ({ userId: 1, teamId: 1, role: "MEMBER", userOu: null }),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    prompt: { findUnique: mockPromptFindUnique },
    contextDocument: { findUnique: mockContextFindUnique },
    build: { findUnique: mockBuildFindUnique },
    skill: { findUnique: mockSkillFindUnique },
  },
}));

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
const DATA_URL = `data:image/png;base64,${PNG_BASE64}`;

async function buildThumbnailsApp() {
  const { thumbnailsRouter } = await import("../src/routes/thumbnails");
  const app = express();
  app.use("/api/thumbnails", thumbnailsRouter);
  return app;
}

describe("GET /api/thumbnails/:assetType/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("decodes a data:image/png;base64 thumbnail and returns the binary body", async () => {
    mockPromptFindUnique.mockResolvedValue({
      teamId: 1,
      ownerId: 1,
      visibility: "PUBLIC",
      thumbnailUrl: DATA_URL,
      owner: { ou: null },
    });

    const app = await buildThumbnailsApp();
    const response = await request(app)
      .get("/api/thumbnails/prompt/42")
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("image/png");
    expect(response.headers["cache-control"]).toMatch(/max-age=\d+/);
    expect(response.headers["etag"]).toMatch(/^".+"$/);

    const expected = Buffer.from(PNG_BASE64, "base64");
    expect(Buffer.compare(response.body as Buffer, expected)).toBe(0);
  });

  it("honors If-None-Match with a 304 response", async () => {
    mockPromptFindUnique.mockResolvedValue({
      teamId: 1,
      ownerId: 1,
      visibility: "PUBLIC",
      thumbnailUrl: DATA_URL,
      owner: { ou: null },
    });

    const app = await buildThumbnailsApp();
    const first = await request(app).get("/api/thumbnails/prompt/42");
    expect(first.status).toBe(200);
    const etag = first.headers["etag"] as string;

    const second = await request(app).get("/api/thumbnails/prompt/42").set("If-None-Match", etag);
    expect(second.status).toBe(304);
    expect(second.body).toEqual({});
  });

  it("302-redirects when the thumbnailUrl is a regular /uploads path", async () => {
    mockBuildFindUnique.mockResolvedValue({
      teamId: 1,
      ownerId: 1,
      visibility: "PUBLIC",
      thumbnailUrl: "/uploads/build-abc.png",
      owner: { ou: null },
    });

    const app = await buildThumbnailsApp();
    const response = await request(app).get("/api/thumbnails/build/7");

    expect(response.status).toBe(302);
    expect(response.headers["location"]).toBe("/uploads/build-abc.png");
  });

  it("returns 404 when the row does not exist", async () => {
    mockPromptFindUnique.mockResolvedValue(null);

    const app = await buildThumbnailsApp();
    const response = await request(app).get("/api/thumbnails/prompt/999");

    expect(response.status).toBe(404);
  });

  it("returns 404 when the row has no thumbnailUrl", async () => {
    mockPromptFindUnique.mockResolvedValue({
      teamId: 1,
      ownerId: 1,
      visibility: "PUBLIC",
      thumbnailUrl: null,
      owner: { ou: null },
    });

    const app = await buildThumbnailsApp();
    const response = await request(app).get("/api/thumbnails/prompt/42");

    expect(response.status).toBe(404);
  });

  it("returns 404 when the asset type is unknown", async () => {
    const app = await buildThumbnailsApp();
    const response = await request(app).get("/api/thumbnails/widget/1");
    expect(response.status).toBe(404);
  });

  it("returns 404 (not 403) when the viewer cannot access a PRIVATE thumbnail, avoiding existence leaks", async () => {
    mockPromptFindUnique.mockResolvedValue({
      teamId: 1,
      ownerId: 999,
      visibility: "PRIVATE",
      thumbnailUrl: DATA_URL,
      owner: { ou: null },
    });

    const app = await buildThumbnailsApp();
    const response = await request(app).get("/api/thumbnails/prompt/42");
    expect(response.status).toBe(404);
  });
});

describe("parseDataUrl", () => {
  it("parses image/png;base64 data URLs", async () => {
    const { parseDataUrl } = await import("../src/routes/thumbnails");
    const parsed = parseDataUrl(DATA_URL);
    expect(parsed).not.toBeNull();
    expect(parsed?.mimeType).toBe("image/png");
    expect(Buffer.compare(parsed!.body, Buffer.from(PNG_BASE64, "base64"))).toBe(0);
  });

  it("returns null for malformed inputs", async () => {
    const { parseDataUrl } = await import("../src/routes/thumbnails");
    expect(parseDataUrl("not a data url")).toBeNull();
    expect(parseDataUrl("data:")).toBeNull();
  });
});

describe("thumbnailRefFor", () => {
  it("returns null when status is not READY", async () => {
    const { thumbnailRefFor } = await import("../src/routes/thumbnails");
    expect(thumbnailRefFor("prompt", 1, "PENDING", new Date())).toBeNull();
    expect(thumbnailRefFor("prompt", 1, "FAILED", new Date())).toBeNull();
    expect(thumbnailRefFor("prompt", 1, null, new Date())).toBeNull();
  });

  it("returns a /api/thumbnails URL with a base-36 version suffix when READY", async () => {
    const { thumbnailRefFor } = await import("../src/routes/thumbnails");
    const ref = thumbnailRefFor("prompt", 101, "READY", new Date("2026-02-01T00:00:00Z"));
    expect(ref).toMatch(/^\/api\/thumbnails\/prompt\/101\?v=[0-9a-z]+$/);
  });
});
