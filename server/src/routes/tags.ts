import type { Request, Response } from "express";
import { Router } from "express";
import { getAuthContext, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const tagsRouter = Router();

tagsRouter.use(requireAuth);

tagsRouter.get("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const tags = await prisma.tag.findMany({
    where: { teamId: auth.teamId },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { promptTags: true },
      },
    },
  });

  const data = tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    promptCount: tag._count.promptTags,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  }));

  return res.status(200).json({ data });
});

tagsRouter.post("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const { name } = req.body as { name?: string };

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Tag name is required." } });
  }

  const trimmedName = name.trim();

  const existing = await prisma.tag.findUnique({
    where: {
      teamId_name: {
        teamId: auth.teamId,
        name: trimmedName,
      },
    },
  });

  if (existing) {
    return res.status(409).json({ error: { code: "CONFLICT", message: "Tag already exists." } });
  }

  const tag = await prisma.tag.create({
    data: {
      teamId: auth.teamId,
      name: trimmedName,
    },
  });

  return res.status(201).json({ data: tag });
});

export { tagsRouter };
