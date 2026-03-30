import type { Request, Response } from "express";
import { Router } from "express";
import { getAuthContext, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const collectionsRouter = Router();
collectionsRouter.use(requireAuth);

collectionsRouter.get("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const collections = await prisma.collection.findMany({
    where: { teamId: auth.teamId },
    include: { prompts: { include: { prompt: true }, orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return res.status(200).json({ data: collections });
});

collectionsRouter.post("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "name is required." } });
  }
  const created = await prisma.collection.create({
    data: {
      teamId: auth.teamId,
      createdById: auth.userId,
      name: name.trim(),
      description: description?.trim() || null,
    },
  });
  return res.status(201).json({ data: created });
});

collectionsRouter.patch("/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const collectionId = Number(req.params.id);
  const existing = await prisma.collection.findFirst({
    where: { id: collectionId, teamId: auth.teamId },
    select: { id: true },
  });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Collection not found." } });
  }
  const updated = await prisma.collection.update({
    where: { id: collectionId },
    data: {
      name: typeof req.body.name === "string" ? req.body.name.trim() : undefined,
      description: typeof req.body.description === "string" ? req.body.description.trim() : undefined,
    },
  });
  return res.status(200).json({ data: updated });
});

collectionsRouter.post("/:id/prompts/:promptId", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const collectionId = Number(req.params.id);
  const promptId = Number(req.params.promptId);

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
  const collectionId = Number(req.params.id);
  const promptId = Number(req.params.promptId);

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

export { collectionsRouter };
