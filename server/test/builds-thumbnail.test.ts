import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPrismaMock } from "./helpers/mockPrisma";

const mockGeneratePromptThumbnail = vi.fn();

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

vi.mock("../src/services/nanoBanana", () => ({
  generatePromptThumbnail: mockGeneratePromptThumbnail,
}));

vi.mock("../src/services/dedup", async () => {
  const actual = await vi.importActual<typeof import("../src/services/dedup")>(
    "../src/services/dedup",
  );
  return {
    ...actual,
    checkBuildDuplicates: vi.fn().mockResolvedValue({ hasDuplicate: false, matches: [] }),
  };
});

async function buildBuildsApp() {
  const { buildsRouter } = await import("../src/routes/builds");
  const app = express();
  app.use(express.json());
  app.use("/api/builds", buildsRouter);
  return app;
}

const build = prismaMock.build as Record<string, ReturnType<typeof vi.fn>>;
const tag = prismaMock.tag as Record<string, ReturnType<typeof vi.fn>>;
const buildTag = prismaMock.buildTag as Record<string, ReturnType<typeof vi.fn>>;

const PNG_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);

describe("builds thumbnail upload + AI-skip behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips AI thumbnail generation when skipThumbnailGeneration=true", async () => {
    const app = await buildBuildsApp();
    build.create.mockResolvedValue({
      id: 42,
      teamId: 1,
      ownerId: 1,
      title: "My Build",
      summary: null,
      buildUrl: "https://example.com/my-build",
      supportUrl: null,
      visibility: "PUBLIC",
      status: "DRAFT",
      modality: "TEXT",
      thumbnailUrl: null,
      thumbnailStatus: "PENDING",
      thumbnailError: null,
      isSmartPick: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 1, name: "Owner", avatarUrl: null },
    });
    build.findUnique.mockResolvedValue({
      id: 42,
      teamId: 1,
      ownerId: 1,
      title: "My Build",
      summary: null,
      buildUrl: "https://example.com/my-build",
      buildUrlNormalized: "https://example.com/my-build",
      supportUrl: null,
      visibility: "PUBLIC",
      status: "DRAFT",
      modality: "TEXT",
      thumbnailUrl: null,
      thumbnailStatus: "PENDING",
      thumbnailError: null,
      isSmartPick: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 1, name: "Owner", avatarUrl: null },
      buildTags: [] as { tag: { name: string } }[],
    });
    tag.count.mockResolvedValue(1);
    buildTag.createMany.mockResolvedValue({ count: 1 });

    const response = await request(app).post("/api/builds").send({
      title: "My Build",
      buildUrl: "https://example.com/my-build",
      skipThumbnailGeneration: true,
      tagIds: [1],
    });

    expect(response.status).toBe(201);
    // Give any microtask a tick to run in case the code did queue the call.
    await new Promise((resolve) => setImmediate(resolve));
    expect(mockGeneratePromptThumbnail).not.toHaveBeenCalled();
  });

  it("still queues AI thumbnail generation when skipThumbnailGeneration is omitted", async () => {
    const app = await buildBuildsApp();
    build.create.mockResolvedValue({
      id: 43,
      teamId: 1,
      ownerId: 1,
      title: "AI Build",
      summary: null,
      buildUrl: "https://example.com/ai-build",
      supportUrl: null,
      visibility: "PUBLIC",
      status: "DRAFT",
      modality: "TEXT",
      thumbnailUrl: null,
      thumbnailStatus: "PENDING",
      thumbnailError: null,
      isSmartPick: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 1, name: "Owner", avatarUrl: null },
    });
    const buildOut = {
      id: 43,
      teamId: 1,
      ownerId: 1,
      title: "AI Build",
      summary: null,
      buildUrl: "https://example.com/ai-build",
      buildUrlNormalized: "https://example.com/ai-build",
      supportUrl: null,
      visibility: "PUBLIC",
      status: "DRAFT",
      modality: "TEXT",
      thumbnailUrl: null,
      thumbnailStatus: "PENDING",
      thumbnailError: null,
      isSmartPick: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 1, name: "Owner", avatarUrl: null },
      buildTags: [] as { tag: { name: string } }[],
    };
    build.findUnique.mockResolvedValue(buildOut);
    mockGeneratePromptThumbnail.mockResolvedValue("data:image/png;base64,AAA");
    tag.count.mockResolvedValue(1);
    buildTag.createMany.mockResolvedValue({ count: 1 });

    const response = await request(app).post("/api/builds").send({
      title: "AI Build",
      buildUrl: "https://example.com/ai-build",
      tagIds: [1],
    });

    expect(response.status).toBe(201);
    await new Promise((resolve) => setImmediate(resolve));
    expect(mockGeneratePromptThumbnail).toHaveBeenCalledTimes(1);
  });

  it("uploads a user-provided thumbnail and stores a /uploads URL", async () => {
    const app = await buildBuildsApp();
    build.findUnique.mockResolvedValue({
      id: 77,
      teamId: 1,
      ownerId: 1,
      thumbnailUrl: null,
    });
    build.update.mockResolvedValue({
      id: 77,
      teamId: 1,
      ownerId: 1,
      title: "Uploaded",
      summary: null,
      buildUrl: "https://example.com/u",
      supportUrl: null,
      visibility: "PUBLIC",
      status: "DRAFT",
      modality: "TEXT",
      thumbnailUrl: "/uploads/build-xxx.png",
      thumbnailStatus: "READY",
      thumbnailError: null,
      isSmartPick: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: { id: 1, name: "Owner", avatarUrl: null },
    });

    const response = await request(app)
      .post("/api/builds/77/thumbnail")
      .attach("thumbnail", PNG_PIXEL, { filename: "pic.png", contentType: "image/png" });

    expect(response.status).toBe(200);
    expect(response.body.data.thumbnailStatus).toBe("READY");
    expect(build.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 77 },
        data: expect.objectContaining({
          thumbnailStatus: "READY",
          thumbnailError: null,
          thumbnailUrl: expect.stringMatching(/^\/uploads\/build-/),
        }),
      }),
    );
  });

  it("rejects a non-image upload with a 500-class multer error", async () => {
    const app = await buildBuildsApp();
    build.findUnique.mockResolvedValue({
      id: 77,
      teamId: 1,
      ownerId: 1,
      thumbnailUrl: null,
    });

    const response = await request(app)
      .post("/api/builds/77/thumbnail")
      .attach("thumbnail", Buffer.from("not an image"), {
        filename: "evil.txt",
        contentType: "text/plain",
      });

    // multer errors surface as 500 unless a custom error handler is registered;
    // either way, we must NOT have updated the build.
    expect([400, 500]).toContain(response.status);
    expect(build.update).not.toHaveBeenCalled();
  });

  it("returns 403 when a non-owner/non-admin tries to upload", async () => {
    const app = await buildBuildsApp();
    build.findUnique.mockResolvedValue({
      id: 77,
      teamId: 1,
      ownerId: 999,
      thumbnailUrl: null,
    });

    const response = await request(app)
      .post("/api/builds/77/thumbnail")
      .attach("thumbnail", PNG_PIXEL, { filename: "pic.png", contentType: "image/png" });

    expect(response.status).toBe(403);
    expect(build.update).not.toHaveBeenCalled();
  });

  it("returns 400 when no file is attached", async () => {
    const app = await buildBuildsApp();
    build.findUnique.mockResolvedValue({
      id: 77,
      teamId: 1,
      ownerId: 1,
      thumbnailUrl: null,
    });

    const response = await request(app).post("/api/builds/77/thumbnail");

    expect(response.status).toBe(400);
    expect(build.update).not.toHaveBeenCalled();
  });
});
