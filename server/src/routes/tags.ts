import type { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { getAuthContext, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const tagsRouter = Router();
type TagWithPromptCount = Prisma.TagGetPayload<{
  include: {
    _count: {
      select: { promptTags: true };
    };
  };
}>;
const createTagBodySchema = z.object({
  name: z.string().trim().min(1, "Tag name is required."),
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

  const data = tags.map((tag: TagWithPromptCount) => ({
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

  const parsedBody = createTagBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const trimmedName = parsedBody.data.name;

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
