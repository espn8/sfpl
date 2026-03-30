import { PromptStatus, Prisma, UsageAction } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { getAuthContext, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const promptsRouter = Router();

type PromptSort = "recent" | "topRated" | "mostUsed";

function parseSort(value: unknown): PromptSort {
  if (value === "topRated" || value === "mostUsed") {
    return value;
  }
  return "recent";
}

function parseStatus(value: unknown): PromptStatus | undefined {
  if (value === "DRAFT" || value === "PUBLISHED" || value === "ARCHIVED") {
    return value;
  }
  return undefined;
}

promptsRouter.use(requireAuth);

promptsRouter.get("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const collectionId = typeof req.query.collectionId === "string" ? Number(req.query.collectionId) : undefined;
  const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : undefined;
  const status = parseStatus(req.query.status);
  const sort = parseSort(req.query.sort);

  const where: Prisma.PromptWhereInput = {
    teamId: auth.teamId,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [{ title: { contains: q, mode: "insensitive" } }, { summary: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }],
        }
      : {}),
    ...(tag ? { promptTags: { some: { tag: { name: { equals: tag, mode: "insensitive" } } } } } : {}),
    ...(collectionId ? { collections: { some: { collectionId } } } : {}),
  };

  const prompts = await prisma.prompt.findMany({
    where,
    include: {
      _count: { select: { favorites: true, ratings: true, usageEvents: true } },
      ratings: { select: { value: true } },
      promptTags: { include: { tag: true } },
    },
    orderBy:
      sort === "topRated"
        ? { ratings: { _count: "desc" } }
        : sort === "mostUsed"
          ? { usageEvents: { _count: "desc" } }
          : { createdAt: "desc" },
  });

  const data = prompts.map((prompt) => ({
    id: prompt.id,
    title: prompt.title,
    summary: prompt.summary,
    status: prompt.status,
    visibility: prompt.visibility,
    modelHint: prompt.modelHint,
    modality: prompt.modality,
    createdAt: prompt.createdAt,
    updatedAt: prompt.updatedAt,
    tags: prompt.promptTags.map((item) => item.tag.name),
    favoriteCount: prompt._count.favorites,
    ratingCount: prompt._count.ratings,
    usageCount: prompt._count.usageEvents,
    averageRating:
      prompt.ratings.length === 0
        ? null
        : prompt.ratings.reduce((sum, item) => sum + item.value, 0) / prompt.ratings.length,
  }));

  return res.status(200).json({ data });
});

promptsRouter.post("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const { title, summary, body, visibility, status, modelHint, modality } = req.body as {
    title?: string;
    summary?: string;
    body?: string;
    visibility?: "TEAM" | "PRIVATE";
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    modelHint?: string;
    modality?: string;
  };

  if (!title || !body) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "title and body are required." } });
  }

  const prompt = await prisma.prompt.create({
    data: {
      teamId: auth.teamId,
      ownerId: auth.userId,
      title: title.trim(),
      summary: summary?.trim() || null,
      body,
      visibility: visibility ?? "TEAM",
      status: status ?? "DRAFT",
      modelHint: modelHint?.trim() || null,
      modality: modality?.trim() || null,
      versions: {
        create: {
          version: 1,
          body,
          createdById: auth.userId,
          changelog: "Initial version",
        },
      },
    },
  });

  return res.status(201).json({ data: prompt });
});

promptsRouter.get("/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const promptId = Number(req.params.id);
  const prompt = await prisma.prompt.findFirst({
    where: { id: promptId, teamId: auth.teamId },
    include: {
      promptTags: { include: { tag: true } },
      variables: true,
      ratings: true,
      _count: { select: { favorites: true, usageEvents: true } },
    },
  });

  if (!prompt) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }

  return res.status(200).json({ data: prompt });
});

promptsRouter.patch("/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const promptId = Number(req.params.id);
  const existing = await prisma.prompt.findFirst({ where: { id: promptId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }

  const nextBody = typeof req.body.body === "string" ? req.body.body : existing.body;
  const updated = await prisma.prompt.update({
    where: { id: promptId },
    data: {
      title: typeof req.body.title === "string" ? req.body.title.trim() : undefined,
      summary: typeof req.body.summary === "string" ? req.body.summary.trim() : undefined,
      body: nextBody,
      visibility: req.body.visibility,
      status: req.body.status,
      modelHint: typeof req.body.modelHint === "string" ? req.body.modelHint.trim() : undefined,
      modality: typeof req.body.modality === "string" ? req.body.modality.trim() : undefined,
    },
  });

  if (nextBody !== existing.body) {
    const latest = await prisma.promptVersion.findFirst({
      where: { promptId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    await prisma.promptVersion.create({
      data: {
        promptId,
        version: (latest?.version ?? 0) + 1,
        body: nextBody,
        createdById: auth.userId,
        changelog: typeof req.body.changelog === "string" ? req.body.changelog : null,
      },
    });
  }

  return res.status(200).json({ data: updated });
});

promptsRouter.delete("/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const promptId = Number(req.params.id);
  const existing = await prisma.prompt.findFirst({ where: { id: promptId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }

  if (existing.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can archive this prompt." } });
  }

  const archived = await prisma.prompt.update({
    where: { id: promptId },
    data: { status: "ARCHIVED" },
  });

  return res.status(200).json({ data: archived });
});

promptsRouter.get("/:id/versions", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const promptId = Number(req.params.id);
  const prompt = await prisma.prompt.findFirst({ where: { id: promptId, teamId: auth.teamId }, select: { id: true } });
  if (!prompt) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  const versions = await prisma.promptVersion.findMany({
    where: { promptId },
    orderBy: { version: "desc" },
  });
  return res.status(200).json({ data: versions });
});

promptsRouter.post("/:id/restore/:version", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const promptId = Number(req.params.id);
  const targetVersion = Number(req.params.version);
  const prompt = await prisma.prompt.findFirst({ where: { id: promptId, teamId: auth.teamId }, select: { id: true } });
  if (!prompt) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  const version = await prisma.promptVersion.findFirst({ where: { promptId, version: targetVersion } });
  if (!version) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt version not found." } });
  }
  const updated = await prisma.prompt.update({
    where: { id: promptId },
    data: { body: version.body },
  });
  return res.status(200).json({ data: updated });
});

promptsRouter.post("/:id/favorite", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const promptId = Number(req.params.id);
  const prompt = await prisma.prompt.findFirst({ where: { id: promptId, teamId: auth.teamId }, select: { id: true } });
  if (!prompt) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }

  const existing = await prisma.favorite.findUnique({ where: { userId_promptId: { userId: auth.userId, promptId } } });
  if (existing) {
    await prisma.favorite.delete({ where: { userId_promptId: { userId: auth.userId, promptId } } });
    return res.status(200).json({ data: { favorited: false } });
  }
  await prisma.favorite.create({ data: { userId: auth.userId, promptId } });
  return res.status(200).json({ data: { favorited: true } });
});

promptsRouter.post("/:id/rating", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const promptId = Number(req.params.id);
  const value = Number((req.body as { value?: number }).value);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "value must be an integer from 1 to 5." } });
  }
  const prompt = await prisma.prompt.findFirst({ where: { id: promptId, teamId: auth.teamId }, select: { id: true } });
  if (!prompt) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  const rating = await prisma.rating.upsert({
    where: { userId_promptId: { userId: auth.userId, promptId } },
    create: { userId: auth.userId, promptId, value },
    update: { value },
  });
  return res.status(200).json({ data: rating });
});

promptsRouter.post("/:id/usage", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const promptId = Number(req.params.id);
  const action = (req.body as { action?: UsageAction }).action;
  if (!action || !Object.values(UsageAction).includes(action)) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid usage action." } });
  }
  const prompt = await prisma.prompt.findFirst({ where: { id: promptId, teamId: auth.teamId }, select: { id: true } });
  if (!prompt) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  await prisma.usageEvent.create({ data: { promptId, userId: auth.userId, action } });
  return res.status(200).json({ data: { ok: true } });
});

export { promptsRouter };
