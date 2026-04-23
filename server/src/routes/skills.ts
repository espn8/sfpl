import type { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { getAuthContext, requireAuth, requireWriteAccess } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { generatePromptThumbnail } from "../services/nanoBanana";
import {
  checkSkillDuplicates,
  normalizeUrl,
  formatDuplicateError,
} from "../services/dedup";

const skillsRouter = Router();

const promptVisibilitySchema = z.enum(["PUBLIC", "TEAM", "PRIVATE"]);
const promptStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

const SKILL_TOOLS = ["agentforce_vibes", "chatgpt", "claude_code", "claude_cowork", "cursor", "gemini", "meshmesh", "notebooklm", "other", "saleo", "slackbot"] as const;
const skillToolSchema = z.enum(SKILL_TOOLS);

const ARCHIVE_EXTENSIONS = [".zip", ".tar", ".tar.gz", ".tgz", ".tar.bz2", ".7z", ".rar"];

function isValidArchiveUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    return ARCHIVE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

const skillUrlSchema = z
  .string()
  .url("skillUrl must be a valid URL.")
  .refine(isValidArchiveUrl, {
    message: "skillUrl must link to a compressed file (.zip, .tar, .tar.gz, .tgz, .tar.bz2, .7z, or .rar).",
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
  tool: skillToolSchema.optional(),
  sort: z.enum(["recent", "mostUsed"]).optional(),
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

const createSkillBodySchema = z.object({
  title: z.string().trim().min(1, "title is required."),
  summary: z.string().trim().optional(),
  skillUrl: skillUrlSchema,
  supportUrl: z.string().url("supportUrl must be a valid URL.").optional().or(z.literal("")),
  visibility: promptVisibilitySchema.optional(),
  status: promptStatusSchema.optional(),
  tools: z.array(z.union([skillToolSchema, z.string()])).optional(),
});

const updateSkillBodySchema = z
  .object({
    title: z.string().trim().optional(),
    summary: z.string().trim().optional(),
    skillUrl: skillUrlSchema.optional(),
    supportUrl: z.string().url("supportUrl must be a valid URL.").optional().or(z.literal("")),
    visibility: promptVisibilitySchema.optional(),
    status: promptStatusSchema.optional(),
    tools: z.array(z.union([skillToolSchema, z.string()])).optional(),
    changelog: z.string().trim().optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one field must be provided.",
  );

type ThumbnailStatusValue = "PENDING" | "READY" | "FAILED";

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

async function queueSkillThumbnailGeneration(skillId: number) {
  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
    select: { id: true, title: true, summary: true },
  });
  if (!skill) {
    console.warn(`[Thumbnail] Skill ${skillId} not found, skipping thumbnail generation.`);
    return;
  }

  console.log(`[Thumbnail] Starting generation for skill ${skillId}: "${skill.title}"`);

  try {
    const thumbnailUrl = await generatePromptThumbnail({
      title: skill.title,
      summary: skill.summary,
      body: skill.summary || skill.title,
    });
    await prisma.skill.update({
      where: { id: skillId },
      data: {
        thumbnailUrl,
        thumbnailStatus: "READY",
        thumbnailError: null,
      },
    });
    console.log(`[Thumbnail] Successfully generated thumbnail for skill ${skillId}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.slice(0, 400) : "Unknown thumbnail generation error.";
    console.error(`[Thumbnail] Failed to generate thumbnail for skill ${skillId}:`, message);
    await prisma.skill.update({
      where: { id: skillId },
      data: {
        thumbnailStatus: "FAILED",
        thumbnailError: message,
      },
    });
  }
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
  const tool = parsedQuery.data.tool;
  const sort = parsedQuery.data.sort ?? "recent";
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
  if (tool) {
    where.tools = { has: tool };
  }
  if (q) {
    const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [
      ...existingAnd,
      {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const orderBy: Prisma.SkillOrderByWithRelationInput =
    sort === "mostUsed"
      ? { usageEvents: { _count: "desc" as const } }
      : { createdAt: "desc" as const };

  const [rows, total] = await Promise.all([
    prisma.skill.findMany({
      where,
      select: {
        id: true,
        title: true,
        summary: true,
        skillUrl: true,
        supportUrl: true,
        status: true,
        visibility: true,
        tools: true,
        thumbnailUrl: true,
        thumbnailStatus: true,
        thumbnailError: true,
        isSmartPick: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy,
      skip,
      take: pageSize,
    }),
    prisma.skill.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (includeAnalytics && rows.length > 0) {
    const skillIds = rows.map((r) => r.id);
    const [viewCounts, copyCounts, favoriteCounts, ratingData] = await Promise.all([
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
      prisma.skillRating.groupBy({
        by: ["skillId"],
        where: { skillId: { in: skillIds } },
        _count: { skillId: true },
        _avg: { value: true },
      }),
    ]);

    const viewMap = new Map(viewCounts.map((v) => [v.skillId, v._count.skillId]));
    const copyMap = new Map(copyCounts.map((c) => [c.skillId, c._count.skillId]));
    const favoriteMap = new Map(favoriteCounts.map((f) => [f.skillId, f._count.skillId]));
    const ratingMap = new Map(ratingData.map((r) => [r.skillId, { count: r._count.skillId, avg: r._avg.value }]));

    const dataWithAnalytics = rows.map((row) => {
      const ratingInfo = ratingMap.get(row.id);
      return {
        ...serializeSkill(row),
        viewCount: viewMap.get(row.id) ?? 0,
        copyCount: copyMap.get(row.id) ?? 0,
        favoriteCount: favoriteMap.get(row.id) ?? 0,
        ratingCount: ratingInfo?.count ?? 0,
        averageRating: ratingInfo?.avg ?? null,
      };
    });

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

skillsRouter.post("/", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedBody = createSkillBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const { title, summary, skillUrl, supportUrl, visibility, status, tools } = parsedBody.data;

  const duplicateCheck = await checkSkillDuplicates(title, skillUrl);
  if (duplicateCheck.hasDuplicate) {
    return res.status(409).json(formatDuplicateError(duplicateCheck));
  }

  const skill = await prisma.skill.create({
    data: {
      teamId: auth.teamId,
      ownerId: auth.userId,
      title: title.trim(),
      summary: summary?.trim() || null,
      skillUrl,
      skillUrlNormalized: normalizeUrl(skillUrl),
      supportUrl: supportUrl || null,
      visibility: visibility ?? "PUBLIC",
      status: status ?? "DRAFT",
      tools: tools ?? [],
      thumbnailStatus: "PENDING",
      thumbnailError: null,
      versions: {
        create: {
          version: 1,
          title: title.trim(),
          summary: summary?.trim() || null,
          skillUrl,
          supportUrl: supportUrl || null,
          createdById: auth.userId,
          changelog: "Initial version",
        },
      },
    },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  void queueSkillThumbnailGeneration(skill.id);

  return res.status(201).json({
    data: {
      ...serializeSkill(skill),
      thumbnailStatus: skill.thumbnailStatus as ThumbnailStatusValue,
    },
  });
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
    select: {
      id: true,
      teamId: true,
      ownerId: true,
      title: true,
      summary: true,
      skillUrl: true,
      supportUrl: true,
      visibility: true,
      status: true,
      tools: true,
      thumbnailUrl: true,
      thumbnailStatus: true,
      thumbnailError: true,
      isSmartPick: true,
      createdAt: true,
      updatedAt: true,
      owner: { select: { id: true, name: true, avatarUrl: true, ou: true } },
    },
  });

  if (!skill) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Skill not found." } });
  }
  if (!canAccessByVisibility(skill, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this skill." } });
  }

  const [viewCount, copyCount, favoriteCount, favoriteRow, myRatingRow, ratings] = await Promise.all([
    prisma.skillUsageEvent.count({ where: { skillId, eventType: "VIEW" } }),
    prisma.skillUsageEvent.count({ where: { skillId, eventType: "COPY" } }),
    prisma.skillFavorite.count({ where: { skillId } }),
    prisma.skillFavorite.findUnique({ where: { skillId_userId: { skillId, userId: auth.userId } } }),
    prisma.skillRating.findUnique({ where: { userId_skillId: { userId: auth.userId, skillId } } }),
    prisma.skillRating.findMany({ where: { skillId }, select: { value: true } }),
  ]);

  const averageRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.value, 0) / ratings.length
    : null;

  return res.status(200).json({
    data: {
      ...serializeSkill(skill),
      thumbnailStatus: skill.thumbnailStatus as ThumbnailStatusValue,
      viewCount,
      copyCount,
      favoriteCount,
      favorited: Boolean(favoriteRow),
      myRating: myRatingRow?.value ?? null,
      ratings,
      averageRating,
      ratingCount: ratings.length,
    },
  });
});

skillsRouter.patch("/:id", requireWriteAccess, async (req: Request, res: Response) => {
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
  const nextTitle = typeof u.title === "string" ? u.title.trim() : existing.title;
  const nextSummary = typeof u.summary === "string" ? u.summary.trim() || null : existing.summary;
  const nextSkillUrl = u.skillUrl ?? existing.skillUrl;
  const nextSupportUrl = typeof u.supportUrl === "string" ? u.supportUrl || null : existing.supportUrl;

  const titleChanged = nextTitle !== existing.title;
  const urlChanged = nextSkillUrl !== existing.skillUrl;
  if (titleChanged || urlChanged) {
    const duplicateCheck = await checkSkillDuplicates(nextTitle, nextSkillUrl, skillId);
    if (duplicateCheck.hasDuplicate) {
      return res.status(409).json(formatDuplicateError(duplicateCheck));
    }
  }

  const hasContentChange =
    nextTitle !== existing.title ||
    nextSummary !== existing.summary ||
    nextSkillUrl !== existing.skillUrl ||
    nextSupportUrl !== existing.supportUrl;

  if (hasContentChange) {
    const latest = await prisma.skillVersion.findFirst({
      where: { skillId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    await prisma.skillVersion.create({
      data: {
        skillId,
        version: (latest?.version ?? 0) + 1,
        title: nextTitle,
        summary: nextSummary,
        skillUrl: nextSkillUrl,
        supportUrl: nextSupportUrl,
        createdById: auth.userId,
        changelog: typeof u.changelog === "string" ? u.changelog : null,
      },
    });
  }

  const updated = await prisma.skill.update({
    where: { id: skillId },
    data: {
      title: nextTitle,
      summary: nextSummary,
      skillUrl: nextSkillUrl,
      skillUrlNormalized: urlChanged ? normalizeUrl(nextSkillUrl) : undefined,
      supportUrl: nextSupportUrl,
      visibility: u.visibility,
      status: u.status,
      tools: u.tools,
    },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return res.status(200).json({ data: serializeSkill(updated) });
});

skillsRouter.delete("/:id", requireWriteAccess, async (req: Request, res: Response) => {
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

skillsRouter.delete("/:id/permanent", requireWriteAccess, async (req: Request, res: Response) => {
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
    prisma.skillRating.deleteMany({ where: { skillId } }),
    prisma.skillVersion.deleteMany({ where: { skillId } }),
    prisma.collectionSkill.deleteMany({ where: { skillId } }),
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

const ratingBodySchema = z.object({
  value: z.number().int().min(1).max(5),
});

skillsRouter.post("/:id/rating", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = skillIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const parsedBody = ratingBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const skillId = parsedParams.data.id;
  const { value } = parsedBody.data;

  const skill = await prisma.skill.findFirst({
    where: { id: skillId, teamId: auth.teamId },
    select: { id: true, ownerId: true },
  });
  if (!skill) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Skill not found." } });
  }
  if (skill.ownerId === auth.userId) {
    return res
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "You can't rate your own skill." } });
  }

  await prisma.skillRating.upsert({
    where: { userId_skillId: { userId: auth.userId, skillId } },
    update: { value },
    create: { userId: auth.userId, skillId, value },
  });

  return res.status(200).json({ data: { ok: true, value } });
});

skillsRouter.post("/:id/regenerate-thumbnail", requireWriteAccess, async (req: Request, res: Response) => {
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
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can modify this skill." } });
  }

  const queued = await prisma.skill.update({
    where: { id: skillId },
    data: {
      thumbnailStatus: "PENDING",
      thumbnailError: null,
    },
  });

  void queueSkillThumbnailGeneration(skillId);

  return res.status(202).json({
    data: {
      id: queued.id,
      thumbnailStatus: queued.thumbnailStatus as ThumbnailStatusValue,
    },
  });
});

const collectionSkillParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  collectionId: z.coerce.number().int().positive(),
});

skillsRouter.post("/:id/collections/:collectionId", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = collectionSkillParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const skillId = parsedParams.data.id;
  const collectionId = parsedParams.data.collectionId;

  const [skill, collection] = await Promise.all([
    prisma.skill.findFirst({ where: { id: skillId, teamId: auth.teamId }, select: { id: true } }),
    prisma.collection.findFirst({ where: { id: collectionId, teamId: auth.teamId }, select: { id: true } }),
  ]);

  if (!skill || !collection) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Skill or collection not found." } });
  }

  const maxSort = await prisma.collectionSkill.aggregate({
    where: { collectionId },
    _max: { sortOrder: true },
  });

  const linked = await prisma.collectionSkill.upsert({
    where: { collectionId_skillId: { collectionId, skillId } },
    create: {
      collectionId,
      skillId,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    update: {},
  });

  return res.status(200).json({ data: linked });
});

skillsRouter.delete("/:id/collections/:collectionId", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = collectionSkillParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const skillId = parsedParams.data.id;
  const collectionId = parsedParams.data.collectionId;

  const existing = await prisma.collectionSkill.findFirst({
    where: {
      collectionId,
      skillId,
      collection: { teamId: auth.teamId },
    },
  });

  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Skill not in this collection." } });
  }

  await prisma.collectionSkill.delete({ where: { collectionId_skillId: { collectionId, skillId } } });
  return res.status(200).json({ data: { ok: true } });
});

skillsRouter.get("/:id/versions", async (req: Request, res: Response) => {
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

  const versions = await prisma.skillVersion.findMany({
    where: { skillId },
    orderBy: { version: "desc" },
  });

  return res.status(200).json({ data: versions });
});

const skillRestoreParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  version: z.coerce.number().int().positive(),
});

skillsRouter.post("/:id/restore/:version", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = skillRestoreParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const skillId = parsedParams.data.id;
  const targetVersion = parsedParams.data.version;

  const skill = await prisma.skill.findFirst({ where: { id: skillId, teamId: auth.teamId } });
  if (!skill) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Skill not found." } });
  }

  if (skill.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can restore this skill." } });
  }

  const version = await prisma.skillVersion.findFirst({ where: { skillId, version: targetVersion } });
  if (!version) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Skill version not found." } });
  }

  const updated = await prisma.skill.update({
    where: { id: skillId },
    data: {
      title: version.title,
      summary: version.summary,
      skillUrl: version.skillUrl,
      supportUrl: version.supportUrl,
    },
  });

  return res.status(200).json({ data: updated });
});

export { skillsRouter };
