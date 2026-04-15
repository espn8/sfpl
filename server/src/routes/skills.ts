import type { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { getAuthContext, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const skillsRouter = Router();

const promptVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);
const promptStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

const MAX_BODY_LENGTH = 500_000;

function badRequestFromZodError(error: z.ZodError) {
  return {
    error: {
      code: "BAD_REQUEST",
      message: "Invalid request.",
      details: error.issues,
    },
  };
}

function isAdminOrOwner(role: string): boolean {
  return role === "ADMIN" || role === "OWNER";
}

const listSkillsQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: promptStatusSchema.optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const skillIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const usageBodySchema = z.object({
  eventType: z.enum(["VIEW", "COPY"]),
});

const createSkillBodySchema = z.object({
  title: z.string().trim().min(1, "title is required."),
  summary: z.string().trim().optional(),
  body: z.string().min(1, "body is required.").max(MAX_BODY_LENGTH, "body is too long."),
  visibility: promptVisibilitySchema.optional(),
  status: promptStatusSchema.optional(),
});

const updateSkillBodySchema = z
  .object({
    title: z.string().trim().optional(),
    summary: z.string().trim().optional(),
    body: z.string().min(1).max(MAX_BODY_LENGTH, "body is too long.").optional(),
    visibility: promptVisibilitySchema.optional(),
    status: promptStatusSchema.optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one field must be provided.",
  );

function serializeSkill<T extends { owner: { id: number; name: string | null; avatarUrl: string | null } }>(
  row: T,
): Omit<T, "owner"> & { owner: { id: number; name: string | null; avatarUrl: string | null } } {
  return {
    ...row,
    owner: {
      id: row.owner.id,
      name: row.owner.name,
      avatarUrl: row.owner.avatarUrl,
    },
  };
}

skillsRouter.use(requireAuth);

skillsRouter.get("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedQuery = listSkillsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json(badRequestFromZodError(parsedQuery.error));
  }

  const q = parsedQuery.data.q ?? "";
  const status = parsedQuery.data.status;
  const page = parsedQuery.data.page ?? 1;
  const pageSize = parsedQuery.data.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.SkillWhereInput = { teamId: auth.teamId };
  if (!isAdminOrOwner(auth.role)) {
    where.OR = [{ visibility: "PUBLIC" }, { ownerId: auth.userId }];
  }
  if (status) {
    where.status = status;
  }
  if (q) {
    const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [
      ...existingAnd,
      {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
          { body: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.skill.findMany({
      where,
      select: {
        id: true,
        title: true,
        summary: true,
        body: true,
        status: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.skill.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return res.status(200).json({
    data: rows.map((row) => serializeSkill(row)),
    meta: { page, pageSize, total, totalPages },
  });
});

skillsRouter.post("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedBody = createSkillBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const { title, summary, body, visibility, status } = parsedBody.data;

  const skill = await prisma.skill.create({
    data: {
      teamId: auth.teamId,
      ownerId: auth.userId,
      title: title.trim(),
      summary: summary?.trim() || null,
      body,
      visibility: visibility ?? "PUBLIC",
      status: status ?? "DRAFT",
    },
    include: { owner: { select: { id: true, name: true, avatarUrl: true } } },
  });

  return res.status(201).json({ data: serializeSkill(skill) });
});

skillsRouter.get("/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = skillIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const skillId = parsedParams.data.id;
  const skill = await prisma.skill.findFirst({
    where: { id: skillId, teamId: auth.teamId },
    include: { owner: { select: { id: true, name: true, avatarUrl: true } } },
  });

  if (!skill) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Skill not found." } });
  }
  if (skill.visibility === "PRIVATE" && skill.ownerId !== auth.userId && !isAdminOrOwner(auth.role)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this skill." } });
  }

  const [viewCount, favoriteRow] = await Promise.all([
    prisma.skillUsageEvent.count({ where: { skillId, eventType: "VIEW" } }),
    prisma.skillFavorite.findUnique({ where: { skillId_userId: { skillId, userId: auth.userId } } }),
  ]);

  return res.status(200).json({
    data: {
      ...serializeSkill(skill),
      viewCount,
      favorited: Boolean(favoriteRow),
    },
  });
});

skillsRouter.patch("/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = skillIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = updateSkillBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const skillId = parsedParams.data.id;
  const existing = await prisma.skill.findFirst({ where: { id: skillId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Skill not found." } });
  }

  if (existing.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can modify this skill." } });
  }

  const u = parsedBody.data;
  const updated = await prisma.skill.update({
    where: { id: skillId },
    data: {
      title: typeof u.title === "string" ? u.title.trim() : undefined,
      summary: typeof u.summary === "string" ? u.summary.trim() || null : undefined,
      body: typeof u.body === "string" ? u.body : undefined,
      visibility: u.visibility,
      status: u.status,
    },
    include: { owner: { select: { id: true, name: true, avatarUrl: true } } },
  });

  return res.status(200).json({ data: serializeSkill(updated) });
});

skillsRouter.delete("/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = skillIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const skillId = parsedParams.data.id;
  const existing = await prisma.skill.findFirst({ where: { id: skillId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Skill not found." } });
  }

  if (existing.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can archive this skill." } });
  }

  const archived = await prisma.skill.update({
    where: { id: skillId },
    data: { status: "ARCHIVED" },
  });

  return res.status(200).json({ data: archived });
});

skillsRouter.post("/:id/favorite", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = skillIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const skillId = parsedParams.data.id;
  const skill = await prisma.skill.findFirst({ where: { id: skillId, teamId: auth.teamId } });
  if (!skill) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Skill not found." } });
  }

  const existing = await prisma.skillFavorite.findUnique({
    where: { skillId_userId: { skillId, userId: auth.userId } },
  });
  if (existing) {
    await prisma.skillFavorite.delete({ where: { skillId_userId: { skillId, userId: auth.userId } } });
    return res.status(200).json({ data: { favorited: false } });
  }
  await prisma.skillFavorite.create({ data: { skillId, userId: auth.userId } });
  return res.status(200).json({ data: { favorited: true } });
});

skillsRouter.post("/:id/usage", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = skillIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const parsedBody = usageBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const skillId = parsedParams.data.id;
  const { eventType } = parsedBody.data;

  const skill = await prisma.skill.findFirst({ where: { id: skillId, teamId: auth.teamId } });
  if (!skill) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Skill not found." } });
  }

  await prisma.skillUsageEvent.create({ data: { skillId, userId: auth.userId, eventType } });
  return res.status(200).json({ data: { ok: true } });
});

export { skillsRouter };
