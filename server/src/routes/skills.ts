import type { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { getAuthContext, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const skillsRouter = Router();

const promptVisibilitySchema = z.enum(["PUBLIC", "TEAM", "PRIVATE"]);
const promptStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

const SKILL_TOOLS = ["claude_code", "cursor", "gemini", "meshmesh", "notebooklm", "other", "saleo", "slackbot"] as const;
const skillToolSchema = z.enum(SKILL_TOOLS);

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

function canAccessByVisibility(
  item: { visibility: string; ownerId: number; owner?: { ou: string | null } | null },
  auth: { userId: number; userOu: string | null; role: string },
): boolean {
  if (item.visibility === "PUBLIC") {
    return true;
  }
  if (item.ownerId === auth.userId) {
    return true;
  }
  if (isAdminOrOwner(auth.role)) {
    return true;
  }
  if (item.visibility === "TEAM" && auth.userOu && item.owner?.ou === auth.userOu) {
    return true;
  }
  return false;
}

const listSkillsQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: promptStatusSchema.optional(),
  mine: z.coerce.boolean().optional(),
  includeAnalytics: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const skillIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const usageBodySchema = z.object({
  eventType: z.enum(["VIEW", "COPY"]),
});

const skillVariableItemSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "variable key is required.")
    .max(64, "variable key is too long.")
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/, "variable key must start with a letter and use letters, numbers, or underscores."),
  label: z.string().trim().max(200).optional().nullable(),
  defaultValue: z.string().max(20000).optional().nullable(),
  required: z.boolean().optional(),
});

const replaceSkillVariablesBodySchema = z
  .object({
    variables: z.array(skillVariableItemSchema).max(40, "too many variables."),
  })
  .superRefine((value, ctx) => {
    const keys = value.variables.map((item) => item.key);
    const seen = new Set<string>();
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate variable key: ${key}.`,
          path: ["variables", index, "key"],
        });
        return;
      }
      seen.add(key);
    }
  });

const createSkillBodySchema = z
  .object({
    title: z.string().trim().min(1, "title is required."),
    summary: z.string().trim().optional(),
    body: z.string().min(1, "body is required.").max(MAX_BODY_LENGTH, "body is too long."),
    visibility: promptVisibilitySchema.optional(),
    status: promptStatusSchema.optional(),
    tools: z.array(z.union([skillToolSchema, z.string()])).optional(),
    variables: z.array(skillVariableItemSchema).max(40).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.variables?.length) {
      return;
    }
    const seen = new Set<string>();
    for (let index = 0; index < value.variables.length; index += 1) {
      const key = value.variables[index].key;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate variable key: ${key}.`,
          path: ["variables", index, "key"],
        });
        return;
      }
      seen.add(key);
    }
  });

const updateSkillBodySchema = z
  .object({
    title: z.string().trim().optional(),
    summary: z.string().trim().optional(),
    body: z.string().min(1).max(MAX_BODY_LENGTH, "body is too long.").optional(),
    visibility: promptVisibilitySchema.optional(),
    status: promptStatusSchema.optional(),
    tools: z.array(z.union([skillToolSchema, z.string()])).optional(),
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
  const mine = parsedQuery.data.mine ?? false;
  const includeAnalytics = parsedQuery.data.includeAnalytics ?? false;
  const page = parsedQuery.data.page ?? 1;
  const pageSize = parsedQuery.data.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.SkillWhereInput = { teamId: auth.teamId };
  if (mine) {
    where.ownerId = auth.userId;
  } else if (!isAdminOrOwner(auth.role)) {
    const visibilityConditions: Prisma.SkillWhereInput[] = [
      { visibility: "PUBLIC" },
      { ownerId: auth.userId },
    ];
    if (auth.userOu) {
      visibilityConditions.push({
        visibility: "TEAM",
        owner: { ou: auth.userOu },
      });
    }
    where.OR = visibilityConditions;
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
        tools: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, avatarUrl: true } },
        variables: { select: { id: true, key: true, label: true, defaultValue: true, required: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.skill.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (includeAnalytics && rows.length > 0) {
    const skillIds = rows.map((r) => r.id);
    const [viewCounts, copyCounts, favoriteCounts] = await Promise.all([
      prisma.skillUsageEvent.groupBy({
        by: ["skillId"],
        where: { skillId: { in: skillIds }, eventType: "VIEW" },
        _count: { skillId: true },
      }),
      prisma.skillUsageEvent.groupBy({
        by: ["skillId"],
        where: { skillId: { in: skillIds }, eventType: "COPY" },
        _count: { skillId: true },
      }),
      prisma.skillFavorite.groupBy({
        by: ["skillId"],
        where: { skillId: { in: skillIds } },
        _count: { skillId: true },
      }),
    ]);

    const viewMap = new Map(viewCounts.map((v) => [v.skillId, v._count.skillId]));
    const copyMap = new Map(copyCounts.map((c) => [c.skillId, c._count.skillId]));
    const favoriteMap = new Map(favoriteCounts.map((f) => [f.skillId, f._count.skillId]));

    const dataWithAnalytics = rows.map((row) => ({
      ...serializeSkill(row),
      viewCount: viewMap.get(row.id) ?? 0,
      copyCount: copyMap.get(row.id) ?? 0,
      favoriteCount: favoriteMap.get(row.id) ?? 0,
    }));

    return res.status(200).json({
      data: dataWithAnalytics,
      meta: { page, pageSize, total, totalPages },
    });
  }

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

  const { title, summary, body, visibility, status, tools, variables } = parsedBody.data;

  const skill = await prisma.skill.create({
    data: {
      teamId: auth.teamId,
      ownerId: auth.userId,
      title: title.trim(),
      summary: summary?.trim() || null,
      body,
      visibility: visibility ?? "PUBLIC",
      status: status ?? "DRAFT",
      tools: tools ?? [],
      variables:
        variables && variables.length > 0
          ? {
              create: variables.map((item) => ({
                key: item.key.trim(),
                label: item.label?.trim() || null,
                defaultValue: typeof item.defaultValue === "string" ? item.defaultValue : null,
                required: item.required ?? false,
              })),
            }
          : undefined,
    },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
      variables: { select: { id: true, key: true, label: true, defaultValue: true, required: true } },
    },
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
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true, ou: true } },
      variables: { select: { id: true, key: true, label: true, defaultValue: true, required: true } },
    },
  });

  if (!skill) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Skill not found." } });
  }
  if (!canAccessByVisibility(skill, auth)) {
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
      tools: u.tools,
    },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
      variables: { select: { id: true, key: true, label: true, defaultValue: true, required: true } },
    },
  });

  return res.status(200).json({ data: serializeSkill(updated) });
});

skillsRouter.put("/:id/variables", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = skillIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = replaceSkillVariablesBodySchema.safeParse(req.body);
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

  const rows = parsedBody.data.variables.map((item) => ({
    skillId,
    key: item.key.trim(),
    label: item.label?.trim() || null,
    defaultValue: typeof item.defaultValue === "string" ? item.defaultValue : null,
    required: item.required ?? false,
  }));

  const transactionSteps = [prisma.skillVariable.deleteMany({ where: { skillId } })];
  if (rows.length > 0) {
    transactionSteps.push(prisma.skillVariable.createMany({ data: rows }));
  }
  await prisma.$transaction(transactionSteps);

  const skill = await prisma.skill.findFirst({
    where: { id: skillId, teamId: auth.teamId },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true, ou: true } },
      variables: { select: { id: true, key: true, label: true, defaultValue: true, required: true } },
    },
  });

  if (!skill) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Skill not found." } });
  }
  if (!canAccessByVisibility(skill, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this skill." } });
  }

  return res.status(200).json({ data: serializeSkill(skill) });
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

skillsRouter.delete("/:id/permanent", async (req: Request, res: Response) => {
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

  if (existing.ownerId !== auth.userId) {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Only the owner can permanently delete this skill." },
    });
  }

  await prisma.$transaction([
    prisma.skillUsageEvent.deleteMany({ where: { skillId } }),
    prisma.skillFavorite.deleteMany({ where: { skillId } }),
    prisma.skillVariable.deleteMany({ where: { skillId } }),
    prisma.skill.delete({ where: { id: skillId } }),
  ]);

  return res.status(200).json({ data: { deleted: true, id: skillId } });
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
