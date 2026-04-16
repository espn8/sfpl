import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { getAuthContext, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import {
  refreshAllToolCollections,
  refreshBestOfCollection,
  refreshToolCollection,
} from "../services/systemCollections";

const collectionsRouter = Router();
collectionsRouter.use(requireAuth);

const collectionIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const collectionPromptParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  promptId: z.coerce.number().int().positive(),
});

const createCollectionBodySchema = z.object({
  name: z.string().trim().min(1, "name is required."),
  description: z.string().trim().optional(),
});
const listCollectionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const updateCollectionBodySchema = z
  .object({
    name: z.string().trim().optional(),
    description: z.string().trim().optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one field must be provided.",
  );

function badRequestFromZodError(error: z.ZodError) {
  return {
    error: {
      code: "BAD_REQUEST",
      message: "Invalid request.",
      details: error.issues,
    },
  };
}

function isOwnerOrAdmin(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

collectionsRouter.get("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedQuery = listCollectionsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json(badRequestFromZodError(parsedQuery.error));
  }

  const page = parsedQuery.data.page ?? 1;
  const pageSize = parsedQuery.data.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const [collections, total] = await Promise.all([
    prisma.collection.findMany({
      where: { teamId: auth.teamId },
      include: { prompts: { include: { prompt: true }, orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.collection.count({ where: { teamId: auth.teamId } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return res.status(200).json({
    data: collections,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
    },
  });
});

collectionsRouter.post("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedBody = createCollectionBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }
  const { name, description } = parsedBody.data;
  try {
    const created = await prisma.collection.create({
      data: {
        teamId: auth.teamId,
        createdById: auth.userId,
        name: name.trim(),
        description: description?.trim() || null,
      },
    });
    return res.status(201).json({ data: created });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "A collection with this name already exists for your team.",
        },
      });
    }
    throw error;
  }
});

collectionsRouter.get("/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedParams = collectionIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const collectionId = parsedParams.data.id;
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, teamId: auth.teamId },
    include: { prompts: { include: { prompt: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!collection) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Collection not found." } });
  }
  return res.status(200).json({ data: collection });
});

collectionsRouter.patch("/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedParams = collectionIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = updateCollectionBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const collectionId = parsedParams.data.id;
  const existing = await prisma.collection.findFirst({
    where: { id: collectionId, teamId: auth.teamId },
    select: { id: true, createdById: true, isSystem: true },
  });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Collection not found." } });
  }
  if (existing.isSystem) {
    return res
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "System collections cannot be modified." } });
  }
  if (existing.createdById !== auth.userId && !isOwnerOrAdmin(auth.role)) {
    return res
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "Only owner/admin can modify this collection." } });
  }
  try {
    const updated = await prisma.collection.update({
      where: { id: collectionId },
      data: {
        name: typeof parsedBody.data.name === "string" ? parsedBody.data.name.trim() : undefined,
        description: typeof parsedBody.data.description === "string" ? parsedBody.data.description.trim() : undefined,
      },
    });
    return res.status(200).json({ data: updated });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "A collection with this name already exists for your team.",
        },
      });
    }
    throw error;
  }
});

collectionsRouter.delete("/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedParams = collectionIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const collectionId = parsedParams.data.id;
  const existing = await prisma.collection.findFirst({
    where: { id: collectionId, teamId: auth.teamId },
    select: { id: true, createdById: true, isSystem: true },
  });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Collection not found." } });
  }
  if (existing.isSystem) {
    return res
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "System collections cannot be deleted." } });
  }
  if (existing.createdById !== auth.userId && !isOwnerOrAdmin(auth.role)) {
    return res
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "Only owner/admin can delete this collection." } });
  }
  await prisma.collection.delete({ where: { id: collectionId } });
  return res.status(200).json({ data: { ok: true } });
});

collectionsRouter.post("/:id/prompts/:promptId", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedParams = collectionPromptParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const collectionId = parsedParams.data.id;
  const promptId = parsedParams.data.promptId;

  const [collection, prompt] = await Promise.all([
    prisma.collection.findFirst({ where: { id: collectionId, teamId: auth.teamId }, select: { id: true } }),
    prisma.prompt.findFirst({ where: { id: promptId, teamId: auth.teamId }, select: { id: true } }),
  ]);

  if (!collection || !prompt) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Collection or prompt not found." } });
  }

  const maxSort = await prisma.collectionPrompt.aggregate({
    where: { collectionId },
    _max: { sortOrder: true },
  });

  const linked = await prisma.collectionPrompt.upsert({
    where: { collectionId_promptId: { collectionId, promptId } },
    create: {
      collectionId,
      promptId,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    update: {},
  });

  return res.status(200).json({ data: linked });
});

collectionsRouter.delete("/:id/prompts/:promptId", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedParams = collectionPromptParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const collectionId = parsedParams.data.id;
  const promptId = parsedParams.data.promptId;

  const existing = await prisma.collectionPrompt.findFirst({
    where: {
      collectionId,
      promptId,
      collection: { teamId: auth.teamId },
    },
  });

  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt membership not found." } });
  }
  await prisma.collectionPrompt.delete({ where: { collectionId_promptId: { collectionId, promptId } } });
  return res.status(200).json({ data: { ok: true } });
});

const refreshSystemCollectionsBodySchema = z
  .object({
    type: z.enum(["all", "best_of", "tool"]).optional(),
    tool: z.string().optional(),
  })
  .optional();

collectionsRouter.post("/system/refresh", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  if (!isOwnerOrAdmin(auth.role)) {
    return res
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "Only owner/admin can refresh system collections." } });
  }

  const parsedBody = refreshSystemCollectionsBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const refreshType = parsedBody.data?.type ?? "all";

  try {
    if (refreshType === "best_of") {
      await refreshBestOfCollection(auth.teamId);
    } else if (refreshType === "tool" && parsedBody.data?.tool) {
      await refreshToolCollection(auth.teamId, parsedBody.data.tool);
    } else {
      await refreshAllToolCollections(auth.teamId);
      await refreshBestOfCollection(auth.teamId);
    }
    return res.status(200).json({ data: { ok: true } });
  } catch (error) {
    console.error("Failed to refresh system collections:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to refresh system collections." },
    });
  }
});

export { collectionsRouter };
