import type { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { getAuthContext, requireAuth, requireWriteAccess } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { generatePromptThumbnail } from "../services/nanoBanana";

const buildsRouter = Router();

const promptVisibilitySchema = z.enum(["PUBLIC", "TEAM", "PRIVATE"]);
const promptStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

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

const listBuildsQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: promptStatusSchema.optional(),
  sort: z.enum(["recent", "mostUsed"]).optional(),
  mine: z.coerce.boolean().optional(),
  includeAnalytics: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const buildIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const usageBodySchema = z.object({
  eventType: z.enum(["VIEW", "COPY"]),
});

const createBuildBodySchema = z.object({
  title: z.string().trim().min(1, "title is required."),
  summary: z.string().trim().optional(),
  buildUrl: z.string().url("buildUrl must be a valid URL.").min(1, "buildUrl is required."),
  supportUrl: z.string().url("supportUrl must be a valid URL.").optional().or(z.literal("")),
  visibility: promptVisibilitySchema.optional(),
  status: promptStatusSchema.optional(),
});

const updateBuildBodySchema = z
  .object({
    title: z.string().trim().optional(),
    summary: z.string().trim().optional(),
    buildUrl: z.string().url("buildUrl must be a valid URL.").optional(),
    supportUrl: z.string().url("supportUrl must be a valid URL.").optional().or(z.literal("")),
    visibility: promptVisibilitySchema.optional(),
    status: promptStatusSchema.optional(),
    changelog: z.string().trim().optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one field must be provided.",
  );

type ThumbnailStatusValue = "PENDING" | "READY" | "FAILED";

function serializeBuild<T extends { owner: { id: number; name: string | null; avatarUrl: string | null } }>(
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

async function queueBuildThumbnailGeneration(buildId: number) {
  const build = await prisma.build.findUnique({
    where: { id: buildId },
    select: { id: true, title: true, summary: true, buildUrl: true },
  });
  if (!build) {
    console.warn(`[Thumbnail] Build ${buildId} not found, skipping thumbnail generation.`);
    return;
  }

  console.log(`[Thumbnail] Starting generation for build ${buildId}: "${build.title}"`);

  try {
    const thumbnailUrl = await generatePromptThumbnail({
      title: build.title,
      summary: build.summary,
      body: `Build URL: ${build.buildUrl}`,
    });
    await prisma.build.update({
      where: { id: buildId },
      data: {
        thumbnailUrl,
        thumbnailStatus: "READY",
        thumbnailError: null,
      },
    });
    console.log(`[Thumbnail] Successfully generated thumbnail for build ${buildId}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.slice(0, 400) : "Unknown thumbnail generation error.";
    console.error(`[Thumbnail] Failed to generate thumbnail for build ${buildId}:`, message);
    await prisma.build.update({
      where: { id: buildId },
      data: {
        thumbnailStatus: "FAILED",
        thumbnailError: message,
      },
    });
  }
}

buildsRouter.use(requireAuth);

buildsRouter.get("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedQuery = listBuildsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json(badRequestFromZodError(parsedQuery.error));
  }

  const q = parsedQuery.data.q ?? "";
  const status = parsedQuery.data.status;
  const sort = parsedQuery.data.sort ?? "recent";
  const mine = parsedQuery.data.mine ?? false;
  const includeAnalytics = parsedQuery.data.includeAnalytics ?? false;
  const page = parsedQuery.data.page ?? 1;
  const pageSize = parsedQuery.data.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.BuildWhereInput = { teamId: auth.teamId };
  if (mine) {
    where.ownerId = auth.userId;
  } else if (!isAdminOrOwner(auth.role)) {
    const visibilityConditions: Prisma.BuildWhereInput[] = [
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
        ],
      },
    ];
  }

  const orderBy: Prisma.BuildOrderByWithRelationInput =
    sort === "mostUsed"
      ? { usageEvents: { _count: "desc" as const } }
      : { createdAt: "desc" as const };

  const [rows, total] = await Promise.all([
    prisma.build.findMany({
      where,
      select: {
        id: true,
        title: true,
        summary: true,
        buildUrl: true,
        supportUrl: true,
        status: true,
        visibility: true,
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
    prisma.build.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (includeAnalytics && rows.length > 0) {
    const buildIds = rows.map((r) => r.id);
    const [viewCounts, copyCounts, favoriteCounts, ratingData] = await Promise.all([
      prisma.buildUsageEvent.groupBy({
        by: ["buildId"],
        where: { buildId: { in: buildIds }, eventType: "VIEW" },
        _count: { buildId: true },
      }),
      prisma.buildUsageEvent.groupBy({
        by: ["buildId"],
        where: { buildId: { in: buildIds }, eventType: "COPY" },
        _count: { buildId: true },
      }),
      prisma.buildFavorite.groupBy({
        by: ["buildId"],
        where: { buildId: { in: buildIds } },
        _count: { buildId: true },
      }),
      prisma.buildRating.groupBy({
        by: ["buildId"],
        where: { buildId: { in: buildIds } },
        _count: { buildId: true },
        _avg: { value: true },
      }),
    ]);

    const viewMap = new Map(viewCounts.map((v) => [v.buildId, v._count.buildId]));
    const copyMap = new Map(copyCounts.map((c) => [c.buildId, c._count.buildId]));
    const favoriteMap = new Map(favoriteCounts.map((f) => [f.buildId, f._count.buildId]));
    const ratingMap = new Map(ratingData.map((r) => [r.buildId, { count: r._count.buildId, avg: r._avg.value }]));

    const dataWithAnalytics = rows.map((row) => {
      const ratingInfo = ratingMap.get(row.id);
      return {
        ...serializeBuild(row),
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
    data: rows.map((row) => serializeBuild(row)),
    meta: { page, pageSize, total, totalPages },
  });
});

buildsRouter.post("/", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedBody = createBuildBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const { title, summary, buildUrl, supportUrl, visibility, status } = parsedBody.data;

  const build = await prisma.build.create({
    data: {
      teamId: auth.teamId,
      ownerId: auth.userId,
      title: title.trim(),
      summary: summary?.trim() || null,
      buildUrl,
      supportUrl: supportUrl || null,
      visibility: visibility ?? "PUBLIC",
      status: status ?? "DRAFT",
      thumbnailStatus: "PENDING",
      thumbnailError: null,
      versions: {
        create: {
          version: 1,
          title: title.trim(),
          summary: summary?.trim() || null,
          buildUrl,
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

  void queueBuildThumbnailGeneration(build.id);

  return res.status(201).json({
    data: {
      ...serializeBuild(build),
      thumbnailStatus: build.thumbnailStatus as ThumbnailStatusValue,
    },
  });
});

buildsRouter.get("/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = buildIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const buildId = parsedParams.data.id;
  const build = await prisma.build.findFirst({
    where: { id: buildId, teamId: auth.teamId },
    select: {
      id: true,
      teamId: true,
      ownerId: true,
      title: true,
      summary: true,
      buildUrl: true,
      supportUrl: true,
      visibility: true,
      status: true,
      thumbnailUrl: true,
      thumbnailStatus: true,
      thumbnailError: true,
      isSmartPick: true,
      createdAt: true,
      updatedAt: true,
      owner: { select: { id: true, name: true, avatarUrl: true, ou: true } },
    },
  });

  if (!build) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Build not found." } });
  }
  if (!canAccessByVisibility(build, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this build." } });
  }

  const [viewCount, copyCount, favoriteCount, favoriteRow, myRatingRow, ratings] = await Promise.all([
    prisma.buildUsageEvent.count({ where: { buildId, eventType: "VIEW" } }),
    prisma.buildUsageEvent.count({ where: { buildId, eventType: "COPY" } }),
    prisma.buildFavorite.count({ where: { buildId } }),
    prisma.buildFavorite.findUnique({ where: { buildId_userId: { buildId, userId: auth.userId } } }),
    prisma.buildRating.findUnique({ where: { userId_buildId: { userId: auth.userId, buildId } } }),
    prisma.buildRating.findMany({ where: { buildId }, select: { value: true } }),
  ]);

  const averageRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.value, 0) / ratings.length
    : null;

  return res.status(200).json({
    data: {
      ...serializeBuild(build),
      thumbnailStatus: build.thumbnailStatus as ThumbnailStatusValue,
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

buildsRouter.patch("/:id", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = buildIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = updateBuildBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const buildId = parsedParams.data.id;
  const existing = await prisma.build.findFirst({ where: { id: buildId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Build not found." } });
  }

  if (existing.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can modify this build." } });
  }

  const u = parsedBody.data;
  const nextTitle = typeof u.title === "string" ? u.title.trim() : existing.title;
  const nextSummary = typeof u.summary === "string" ? u.summary.trim() || null : existing.summary;
  const nextBuildUrl = u.buildUrl ?? existing.buildUrl;
  const nextSupportUrl = typeof u.supportUrl === "string" ? u.supportUrl || null : existing.supportUrl;

  const hasContentChange =
    nextTitle !== existing.title ||
    nextSummary !== existing.summary ||
    nextBuildUrl !== existing.buildUrl ||
    nextSupportUrl !== existing.supportUrl;

  if (hasContentChange) {
    const latest = await prisma.buildVersion.findFirst({
      where: { buildId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    await prisma.buildVersion.create({
      data: {
        buildId,
        version: (latest?.version ?? 0) + 1,
        title: nextTitle,
        summary: nextSummary,
        buildUrl: nextBuildUrl,
        supportUrl: nextSupportUrl,
        createdById: auth.userId,
        changelog: typeof u.changelog === "string" ? u.changelog : null,
      },
    });
  }

  const updated = await prisma.build.update({
    where: { id: buildId },
    data: {
      title: nextTitle,
      summary: nextSummary,
      buildUrl: nextBuildUrl,
      supportUrl: nextSupportUrl,
      visibility: u.visibility,
      status: u.status,
    },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return res.status(200).json({ data: serializeBuild(updated) });
});

buildsRouter.delete("/:id", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = buildIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const buildId = parsedParams.data.id;
  const existing = await prisma.build.findFirst({ where: { id: buildId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Build not found." } });
  }

  if (existing.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can archive this build." } });
  }

  const archived = await prisma.build.update({
    where: { id: buildId },
    data: { status: "ARCHIVED" },
  });

  return res.status(200).json({ data: archived });
});

buildsRouter.delete("/:id/permanent", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = buildIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const buildId = parsedParams.data.id;
  const existing = await prisma.build.findFirst({ where: { id: buildId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Build not found." } });
  }

  if (existing.ownerId !== auth.userId) {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Only the owner can permanently delete this build." },
    });
  }

  await prisma.$transaction([
    prisma.buildUsageEvent.deleteMany({ where: { buildId } }),
    prisma.buildFavorite.deleteMany({ where: { buildId } }),
    prisma.buildRating.deleteMany({ where: { buildId } }),
    prisma.buildVersion.deleteMany({ where: { buildId } }),
    prisma.collectionBuild.deleteMany({ where: { buildId } }),
    prisma.build.delete({ where: { id: buildId } }),
  ]);

  return res.status(200).json({ data: { deleted: true, id: buildId } });
});

buildsRouter.post("/:id/favorite", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = buildIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const buildId = parsedParams.data.id;
  const build = await prisma.build.findFirst({ where: { id: buildId, teamId: auth.teamId } });
  if (!build) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Build not found." } });
  }

  const existing = await prisma.buildFavorite.findUnique({
    where: { buildId_userId: { buildId, userId: auth.userId } },
  });
  if (existing) {
    await prisma.buildFavorite.delete({ where: { buildId_userId: { buildId, userId: auth.userId } } });
    return res.status(200).json({ data: { favorited: false } });
  }
  await prisma.buildFavorite.create({ data: { buildId, userId: auth.userId } });
  return res.status(200).json({ data: { favorited: true } });
});

buildsRouter.post("/:id/usage", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = buildIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const parsedBody = usageBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const buildId = parsedParams.data.id;
  const { eventType } = parsedBody.data;

  const build = await prisma.build.findFirst({ where: { id: buildId, teamId: auth.teamId } });
  if (!build) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Build not found." } });
  }

  await prisma.buildUsageEvent.create({ data: { buildId, userId: auth.userId, eventType } });
  return res.status(200).json({ data: { ok: true } });
});

const ratingBodySchema = z.object({
  value: z.number().int().min(1).max(5),
});

buildsRouter.post("/:id/rating", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = buildIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const parsedBody = ratingBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const buildId = parsedParams.data.id;
  const { value } = parsedBody.data;

  const build = await prisma.build.findFirst({ where: { id: buildId, teamId: auth.teamId } });
  if (!build) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Build not found." } });
  }

  await prisma.buildRating.upsert({
    where: { userId_buildId: { userId: auth.userId, buildId } },
    update: { value },
    create: { userId: auth.userId, buildId, value },
  });

  return res.status(200).json({ data: { ok: true, value } });
});

buildsRouter.post("/:id/regenerate-thumbnail", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = buildIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const buildId = parsedParams.data.id;
  const existing = await prisma.build.findFirst({ where: { id: buildId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Build not found." } });
  }

  if (existing.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can modify this build." } });
  }

  const queued = await prisma.build.update({
    where: { id: buildId },
    data: {
      thumbnailStatus: "PENDING",
      thumbnailError: null,
    },
  });

  void queueBuildThumbnailGeneration(buildId);

  return res.status(202).json({
    data: {
      id: queued.id,
      thumbnailStatus: queued.thumbnailStatus as ThumbnailStatusValue,
    },
  });
});

const collectionBuildParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  collectionId: z.coerce.number().int().positive(),
});

buildsRouter.post("/:id/collections/:collectionId", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = collectionBuildParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const buildId = parsedParams.data.id;
  const collectionId = parsedParams.data.collectionId;

  const [build, collection] = await Promise.all([
    prisma.build.findFirst({ where: { id: buildId, teamId: auth.teamId }, select: { id: true } }),
    prisma.collection.findFirst({ where: { id: collectionId, teamId: auth.teamId }, select: { id: true } }),
  ]);

  if (!build || !collection) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Build or collection not found." } });
  }

  const maxSort = await prisma.collectionBuild.aggregate({
    where: { collectionId },
    _max: { sortOrder: true },
  });

  const linked = await prisma.collectionBuild.upsert({
    where: { collectionId_buildId: { collectionId, buildId } },
    create: {
      collectionId,
      buildId,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    update: {},
  });

  return res.status(200).json({ data: linked });
});

buildsRouter.delete("/:id/collections/:collectionId", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = collectionBuildParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const buildId = parsedParams.data.id;
  const collectionId = parsedParams.data.collectionId;

  const existing = await prisma.collectionBuild.findFirst({
    where: {
      collectionId,
      buildId,
      collection: { teamId: auth.teamId },
    },
  });

  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Build not in this collection." } });
  }

  await prisma.collectionBuild.delete({ where: { collectionId_buildId: { collectionId, buildId } } });
  return res.status(200).json({ data: { ok: true } });
});

buildsRouter.get("/:id/versions", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = buildIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const buildId = parsedParams.data.id;
  const build = await prisma.build.findFirst({ where: { id: buildId, teamId: auth.teamId } });
  if (!build) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Build not found." } });
  }

  const versions = await prisma.buildVersion.findMany({
    where: { buildId },
    orderBy: { version: "desc" },
  });

  return res.status(200).json({ data: versions });
});

const buildRestoreParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  version: z.coerce.number().int().positive(),
});

buildsRouter.post("/:id/restore/:version", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = buildRestoreParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const buildId = parsedParams.data.id;
  const targetVersion = parsedParams.data.version;

  const build = await prisma.build.findFirst({ where: { id: buildId, teamId: auth.teamId } });
  if (!build) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Build not found." } });
  }

  if (build.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can restore this build." } });
  }

  const version = await prisma.buildVersion.findFirst({ where: { buildId, version: targetVersion } });
  if (!version) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Build version not found." } });
  }

  const updated = await prisma.build.update({
    where: { id: buildId },
    data: {
      title: version.title,
      summary: version.summary,
      buildUrl: version.buildUrl,
      supportUrl: version.supportUrl,
    },
  });

  return res.status(200).json({ data: updated });
});

export { buildsRouter };
