import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { getAuthContext, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const promptsRouter = Router();

type PromptSort = "recent" | "topRated" | "mostUsed";
type PromptStatusValue = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type UsageActionValue = "VIEW" | "COPY" | "LAUNCH";
const USAGE_ACTIONS: UsageActionValue[] = ["VIEW", "COPY", "LAUNCH"];
const promptVisibilitySchema = z.enum(["TEAM", "PRIVATE"]);
const promptStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const usageActionSchema = z.enum(USAGE_ACTIONS);

const listPromptsQuerySchema = z.object({
  q: z.string().trim().optional(),
  collectionId: z.coerce.number().int().positive().optional(),
  tag: z.string().trim().optional(),
  status: promptStatusSchema.optional(),
  sort: z.enum(["recent", "topRated", "mostUsed"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const promptIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const promptRestoreParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  version: z.coerce.number().int().positive(),
});

const createPromptBodySchema = z.object({
  title: z.string().trim().min(1, "title is required."),
  summary: z.string().trim().optional(),
  body: z.string().min(1, "body is required."),
  visibility: promptVisibilitySchema.optional(),
  status: promptStatusSchema.optional(),
  modelHint: z.string().trim().optional(),
  modality: z.string().trim().optional(),
});

const updatePromptBodySchema = z
  .object({
    title: z.string().trim().optional(),
    summary: z.string().trim().optional(),
    body: z.string().optional(),
    visibility: promptVisibilitySchema.optional(),
    status: promptStatusSchema.optional(),
    modelHint: z.string().trim().optional(),
    modality: z.string().trim().optional(),
    changelog: z.string().optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one field must be provided.",
  );

const ratingBodySchema = z.object({
  value: z.number().int().min(1).max(5),
});

const usageBodySchema = z.object({
  action: usageActionSchema,
});

function badRequestFromZodError(error: z.ZodError) {
  return {
    error: {
      code: "BAD_REQUEST",
      message: "Invalid request.",
      details: error.issues,
    },
  };
}

function parseSort(value: unknown): PromptSort {
  if (value === "topRated" || value === "mostUsed") {
    return value;
  }
  return "recent";
}

promptsRouter.use(requireAuth);

promptsRouter.get("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedQuery = listPromptsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json(badRequestFromZodError(parsedQuery.error));
  }

  const q = parsedQuery.data.q ?? "";
  const collectionId = parsedQuery.data.collectionId;
  const tag = parsedQuery.data.tag;
  const status = parsedQuery.data.status;
  const sort = parseSort(parsedQuery.data.sort);
  const page = parsedQuery.data.page ?? 1;
  const pageSize = parsedQuery.data.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.PromptWhereInput = { teamId: auth.teamId };
  if (status) {
    where.status = status;
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
      { body: { contains: q, mode: "insensitive" } },
    ];
  }
  if (tag) {
    where.promptTags = { some: { tag: { name: { equals: tag, mode: "insensitive" } } } };
  }
  if (collectionId) {
    where.collections = { some: { collectionId } };
  }

  const orderBy: Prisma.PromptOrderByWithRelationInput =
    sort === "topRated"
      ? { ratings: { _count: "desc" as const } }
      : sort === "mostUsed"
        ? { usageEvents: { _count: "desc" as const } }
        : { createdAt: "desc" as const };

  const [prompts, total] = await Promise.all([
    prisma.prompt.findMany({
      where,
      include: {
        _count: { select: { favorites: true, ratings: true, usageEvents: true } },
        ratings: { select: { value: true } },
        promptTags: { include: { tag: true } },
      },
      orderBy,
      skip,
      take: pageSize,
    }),
    prisma.prompt.count({ where }),
  ]);

  type PromptListItem = Prisma.PromptGetPayload<{
    include: {
      _count: { select: { favorites: true; ratings: true; usageEvents: true } };
      ratings: { select: { value: true } };
      promptTags: { include: { tag: true } };
    };
  }>;

  const data = (prompts as PromptListItem[]).map((prompt: PromptListItem) => ({
    id: prompt.id,
    title: prompt.title,
    summary: prompt.summary,
    status: prompt.status,
    visibility: prompt.visibility,
    modelHint: prompt.modelHint,
    modality: prompt.modality,
    createdAt: prompt.createdAt,
    updatedAt: prompt.updatedAt,
    tags: prompt.promptTags.map((item: { tag: { name: string } }) => item.tag.name),
    favoriteCount: prompt._count.favorites,
    ratingCount: prompt._count.ratings,
    usageCount: prompt._count.usageEvents,
    averageRating:
      prompt.ratings.length === 0
        ? null
        : prompt.ratings.reduce((sum: number, item: { value: number }) => sum + item.value, 0) / prompt.ratings.length,
  }));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return res.status(200).json({
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
    },
  });
});

promptsRouter.post("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedBody = createPromptBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }
  const { title, summary, body, visibility, status, modelHint, modality } = parsedBody.data;

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

  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const promptId = parsedParams.data.id;
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

  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = updatePromptBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const promptId = parsedParams.data.id;
  const updateData = parsedBody.data;
  const existing = await prisma.prompt.findFirst({ where: { id: promptId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }

  if (existing.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can modify this prompt." } });
  }

  const nextBody = typeof updateData.body === "string" ? updateData.body : existing.body;
  const updated = await prisma.prompt.update({
    where: { id: promptId },
    data: {
      title: typeof updateData.title === "string" ? updateData.title.trim() : undefined,
      summary: typeof updateData.summary === "string" ? updateData.summary.trim() : undefined,
      body: nextBody,
      visibility: updateData.visibility,
      status: updateData.status,
      modelHint: typeof updateData.modelHint === "string" ? updateData.modelHint.trim() : undefined,
      modality: typeof updateData.modality === "string" ? updateData.modality.trim() : undefined,
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
        changelog: typeof updateData.changelog === "string" ? updateData.changelog : null,
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

  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const promptId = parsedParams.data.id;
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
  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const promptId = parsedParams.data.id;
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
  const parsedParams = promptRestoreParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const promptId = parsedParams.data.id;
  const targetVersion = parsedParams.data.version;
  const prompt = await prisma.prompt.findFirst({ where: { id: promptId, teamId: auth.teamId } });
  if (!prompt) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }

  if (prompt.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can restore this prompt." } });
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
  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const promptId = parsedParams.data.id;
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
  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = ratingBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }
  const promptId = parsedParams.data.id;
  const value = parsedBody.data.value;
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
  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = usageBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }
  const promptId = parsedParams.data.id;
  const action = parsedBody.data.action;
  const prompt = await prisma.prompt.findFirst({ where: { id: promptId, teamId: auth.teamId }, select: { id: true } });
  if (!prompt) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  await prisma.usageEvent.create({ data: { promptId, userId: auth.userId, action } });
  return res.status(200).json({ data: { ok: true } });
});

export { promptsRouter };
