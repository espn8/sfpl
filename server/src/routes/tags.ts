import type { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import {
  getAuthContext,
  requireAuth,
  requireOnboardingComplete,
  requireRole,
} from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { normalizeTagNameForStorage } from "../lib/assetTags";

const tagsRouter = Router();

type TagWithCounts = Prisma.TagGetPayload<{
  include: {
    _count: {
      select: {
        promptTags: true;
        skillTags: true;
        contextTags: true;
        buildTags: true;
      };
    };
  };
}>;

const createTagBodySchema = z.object({
  name: z.string().trim().min(1, "Tag name is required.").max(120),
});

const listTagsQuerySchema = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
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

tagsRouter.use(requireAuth);
tagsRouter.use(requireOnboardingComplete);

tagsRouter.get("/", async (req: Request, res: Response) => {
  const parsedQuery = listTagsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json(badRequestFromZodError(parsedQuery.error));
  }

  const q = parsedQuery.data.q ?? "";
  const limit = parsedQuery.data.limit;

  const where: Prisma.TagWhereInput =
    q.length > 0 ? { name: { contains: q, mode: "insensitive" } } : {};

  const tags = await prisma.tag.findMany({
    where,
    orderBy: { name: "asc" },
    ...(limit !== undefined ? { take: limit } : {}),
    include: {
      _count: {
        select: {
          promptTags: true,
          skillTags: true,
          contextTags: true,
          buildTags: true,
        },
      },
    },
  });

  const data = tags.map((tag: TagWithCounts) => ({
    id: tag.id,
    name: tag.name,
    usageCount:
      tag._count.promptTags +
      tag._count.skillTags +
      tag._count.contextTags +
      tag._count.buildTags,
    promptCount: tag._count.promptTags,
    skillCount: tag._count.skillTags,
    contextCount: tag._count.contextTags,
    buildCount: tag._count.buildTags,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  }));

  return res.status(200).json({ data });
});

tagsRouter.post("/", requireRole([Role.ADMIN]), async (req: Request, res: Response) => {
  const parsedBody = createTagBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const storedName = normalizeTagNameForStorage(parsedBody.data.name);
  if (storedName.length === 0) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid tag name." } });
  }

  const existing = await prisma.tag.findFirst({
    where: { name: { equals: storedName, mode: "insensitive" } },
    select: { id: true },
  });

  if (existing) {
    return res.status(409).json({ error: { code: "CONFLICT", message: "Tag already exists." } });
  }

  const tag = await prisma.tag.create({
    data: { name: storedName },
  });

  return res.status(201).json({ data: tag });
});

export { tagsRouter };
