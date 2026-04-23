import type { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { getAuthContext, requireAuth, requireWriteAccess, type AuthContext } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import {
  buildVisibilityWhereFragment,
  canAccessByVisibility as sharedCanAccessByVisibility,
} from "../lib/visibility";
import { generatePromptThumbnail } from "../services/nanoBanana";
import {
  checkContextDuplicates,
  computeBodyHash,
  normalizeTitle,
  formatDuplicateError,
} from "../services/dedup";

const contextRouter = Router();

const promptVisibilitySchema = z.enum(["PUBLIC", "TEAM", "PRIVATE"]);
const promptStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

const CONTEXT_TOOLS = ["agentforce_vibes", "chatgpt", "claude_code", "claude_cowork", "cursor", "gemini", "meshmesh", "notebooklm", "other", "saleo", "slackbot"] as const;
const contextToolSchema = z.enum(CONTEXT_TOOLS);

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

function canAccessByVisibility(
  item: { teamId: number; visibility: string; ownerId: number; owner?: { ou: string | null } | null },
  auth: AuthContext,
): boolean {
  return sharedCanAccessByVisibility(item, auth);
}

const listContextQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: promptStatusSchema.optional(),
  tool: contextToolSchema.optional(),
  sort: z.enum(["recent", "mostUsed"]).optional(),
  mine: z.coerce.boolean().optional(),
  includeAnalytics: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const contextIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const usageBodySchema = z.object({
  eventType: z.enum(["VIEW", "COPY"]),
});

const contextVariableItemSchema = z.object({
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

const replaceContextVariablesBodySchema = z
  .object({
    variables: z.array(contextVariableItemSchema).max(40, "too many variables."),
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

const createContextBodySchema = z
  .object({
    title: z.string().trim().min(1, "title is required."),
    summary: z.string().trim().optional(),
    body: z.string().min(1, "body is required.").max(MAX_BODY_LENGTH, "body is too long."),
    supportUrl: z.string().url("supportUrl must be a valid URL.").optional().or(z.literal("")),
    visibility: promptVisibilitySchema.optional(),
    status: promptStatusSchema.optional(),
    tools: z.array(z.union([contextToolSchema, z.string()])).optional(),
    variables: z.array(contextVariableItemSchema).max(40).optional(),
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

const updateContextBodySchema = z
  .object({
    title: z.string().trim().optional(),
    summary: z.string().trim().optional(),
    body: z.string().min(1).max(MAX_BODY_LENGTH, "body is too long.").optional(),
    supportUrl: z.string().url("supportUrl must be a valid URL.").optional().or(z.literal("")),
    visibility: promptVisibilitySchema.optional(),
    status: promptStatusSchema.optional(),
    tools: z.array(z.union([contextToolSchema, z.string()])).optional(),
    changelog: z.string().trim().optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one field must be provided.",
  );

type ThumbnailStatusValue = "PENDING" | "READY" | "FAILED";

function serializeContextDoc<T extends { owner: { id: number; name: string | null; avatarUrl: string | null } }>(
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

async function queueContextThumbnailGeneration(contextId: number) {
  const doc = await prisma.contextDocument.findUnique({
    where: { id: contextId },
    select: { id: true, title: true, summary: true, body: true },
  });
  if (!doc) {
    console.warn(`[Thumbnail] Context ${contextId} not found, skipping thumbnail generation.`);
    return;
  }

  console.log(`[Thumbnail] Starting generation for context ${contextId}: "${doc.title}"`);

  try {
    const thumbnailUrl = await generatePromptThumbnail({
      title: doc.title,
      summary: doc.summary,
      body: doc.body,
    });
    await prisma.contextDocument.update({
      where: { id: contextId },
      data: {
        thumbnailUrl,
        thumbnailStatus: "READY",
        thumbnailError: null,
      },
    });
    console.log(`[Thumbnail] Successfully generated thumbnail for context ${contextId}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.slice(0, 400) : "Unknown thumbnail generation error.";
    console.error(`[Thumbnail] Failed to generate thumbnail for context ${contextId}:`, message);
    await prisma.contextDocument.update({
      where: { id: contextId },
      data: {
        thumbnailStatus: "FAILED",
        thumbnailError: message,
      },
    });
  }
}

contextRouter.use(requireAuth);

contextRouter.get("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedQuery = listContextQuerySchema.safeParse(req.query);
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

  const where: Prisma.ContextDocumentWhereInput = {};
  const whereAnd: Prisma.ContextDocumentWhereInput[] = [];
  if (mine) {
    where.ownerId = auth.userId;
    where.teamId = auth.teamId;
  } else {
    whereAnd.push(buildVisibilityWhereFragment(auth) as Prisma.ContextDocumentWhereInput);
  }
  if (status) {
    where.status = status;
  }
  if (tool) {
    where.tools = { has: tool };
  }
  if (q) {
    whereAnd.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
        { body: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (whereAnd.length > 0) {
    where.AND = whereAnd;
  }

  const orderBy: Prisma.ContextDocumentOrderByWithRelationInput =
    sort === "mostUsed"
      ? { usageEvents: { _count: "desc" as const } }
      : { createdAt: "desc" as const };

  const [rows, total] = await Promise.all([
    prisma.contextDocument.findMany({
      where,
      select: {
        id: true,
        title: true,
        summary: true,
        body: true,
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
        variables: { select: { id: true, key: true, label: true, defaultValue: true, required: true } },
      },
      orderBy,
      skip,
      take: pageSize,
    }),
    prisma.contextDocument.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (includeAnalytics && rows.length > 0) {
    const contextIds = rows.map((r) => r.id);
    const [viewCounts, copyCounts, favoriteCounts, ratingData] = await Promise.all([
      prisma.contextUsageEvent.groupBy({
        by: ["contextId"],
        where: { contextId: { in: contextIds }, eventType: "VIEW" },
        _count: { contextId: true },
      }),
      prisma.contextUsageEvent.groupBy({
        by: ["contextId"],
        where: { contextId: { in: contextIds }, eventType: "COPY" },
        _count: { contextId: true },
      }),
      prisma.contextFavorite.groupBy({
        by: ["contextId"],
        where: { contextId: { in: contextIds } },
        _count: { contextId: true },
      }),
      prisma.contextRating.groupBy({
        by: ["contextId"],
        where: { contextId: { in: contextIds } },
        _count: { contextId: true },
        _avg: { value: true },
      }),
    ]);

    const viewMap = new Map(viewCounts.map((v) => [v.contextId, v._count.contextId]));
    const copyMap = new Map(copyCounts.map((c) => [c.contextId, c._count.contextId]));
    const favoriteMap = new Map(favoriteCounts.map((f) => [f.contextId, f._count.contextId]));
    const ratingMap = new Map(ratingData.map((r) => [r.contextId, { count: r._count.contextId, avg: r._avg.value }]));

    const dataWithAnalytics = rows.map((row) => {
      const ratingInfo = ratingMap.get(row.id);
      return {
        ...serializeContextDoc(row),
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
    data: rows.map((row) => serializeContextDoc(row)),
    meta: { page, pageSize, total, totalPages },
  });
});

contextRouter.post("/", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedBody = createContextBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const { title, summary, body, supportUrl, visibility, status, tools, variables } = parsedBody.data;

  const duplicateCheck = await checkContextDuplicates(title, body);
  if (duplicateCheck.hasDuplicate) {
    return res.status(409).json(formatDuplicateError(duplicateCheck));
  }

  const doc = await prisma.contextDocument.create({
    data: {
      teamId: auth.teamId,
      ownerId: auth.userId,
      title: title.trim(),
      titleNormalized: normalizeTitle(title),
      summary: summary?.trim() || null,
      body,
      bodyHash: computeBodyHash(body),
      supportUrl: supportUrl || null,
      visibility: visibility ?? "PUBLIC",
      status: status ?? "DRAFT",
      tools: tools ?? [],
      thumbnailStatus: "PENDING",
      thumbnailError: null,
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
      versions: {
        create: {
          version: 1,
          body,
          supportUrl: supportUrl || null,
          createdById: auth.userId,
          changelog: "Initial version",
        },
      },
    },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
      variables: { select: { id: true, key: true, label: true, defaultValue: true, required: true } },
    },
  });

  void queueContextThumbnailGeneration(doc.id);

  return res.status(201).json({
    data: {
      ...serializeContextDoc(doc),
      thumbnailStatus: doc.thumbnailStatus as ThumbnailStatusValue,
    },
  });
});

contextRouter.get("/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const contextId = parsedParams.data.id;
  const doc = await prisma.contextDocument.findUnique({
    where: { id: contextId },
    select: {
      id: true,
      teamId: true,
      ownerId: true,
      title: true,
      summary: true,
      body: true,
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
      variables: { select: { id: true, key: true, label: true, defaultValue: true, required: true } },
    },
  });

  if (!doc) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }
  if (!canAccessByVisibility(doc, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this document." } });
  }

  const [viewCount, copyCount, favoriteCount, favoriteRow, myRatingRow, ratings] = await Promise.all([
    prisma.contextUsageEvent.count({ where: { contextId, eventType: "VIEW" } }),
    prisma.contextUsageEvent.count({ where: { contextId, eventType: "COPY" } }),
    prisma.contextFavorite.count({ where: { contextId } }),
    prisma.contextFavorite.findUnique({ where: { contextId_userId: { contextId, userId: auth.userId } } }),
    prisma.contextRating.findUnique({ where: { userId_contextId: { userId: auth.userId, contextId } } }),
    prisma.contextRating.findMany({ where: { contextId }, select: { value: true } }),
  ]);

  const averageRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.value, 0) / ratings.length
    : null;

  return res.status(200).json({
    data: {
      ...serializeContextDoc(doc),
      thumbnailStatus: doc.thumbnailStatus as ThumbnailStatusValue,
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

contextRouter.patch("/:id", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = updateContextBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const contextId = parsedParams.data.id;
  const existing = await prisma.contextDocument.findFirst({ where: { id: contextId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  if (existing.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can modify this document." } });
  }

  const u = parsedBody.data;
  const nextTitle = typeof u.title === "string" ? u.title.trim() : existing.title;
  const nextBody = typeof u.body === "string" ? u.body : existing.body;
  const nextSupportUrl = typeof u.supportUrl === "string" ? u.supportUrl || null : existing.supportUrl;

  const titleChanged = nextTitle !== existing.title;
  const bodyChanged = nextBody !== existing.body;
  if (titleChanged || bodyChanged) {
    const duplicateCheck = await checkContextDuplicates(nextTitle, nextBody, contextId);
    if (duplicateCheck.hasDuplicate) {
      return res.status(409).json(formatDuplicateError(duplicateCheck));
    }
  }

  const hasContentChange = nextBody !== existing.body || nextSupportUrl !== existing.supportUrl;

  if (hasContentChange) {
    const latest = await prisma.contextVersion.findFirst({
      where: { contextId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    await prisma.contextVersion.create({
      data: {
        contextId,
        version: (latest?.version ?? 0) + 1,
        body: nextBody,
        supportUrl: nextSupportUrl,
        createdById: auth.userId,
        changelog: typeof u.changelog === "string" ? u.changelog : null,
      },
    });
  }

  const updated = await prisma.contextDocument.update({
    where: { id: contextId },
    data: {
      title: typeof u.title === "string" ? u.title.trim() : undefined,
      titleNormalized: titleChanged ? normalizeTitle(nextTitle) : undefined,
      summary: typeof u.summary === "string" ? u.summary.trim() || null : undefined,
      body: nextBody,
      bodyHash: bodyChanged ? computeBodyHash(nextBody) : undefined,
      supportUrl: nextSupportUrl,
      visibility: u.visibility,
      status: u.status,
      tools: u.tools,
    },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
      variables: { select: { id: true, key: true, label: true, defaultValue: true, required: true } },
    },
  });

  return res.status(200).json({ data: serializeContextDoc(updated) });
});

contextRouter.put("/:id/variables", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = replaceContextVariablesBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const contextId = parsedParams.data.id;
  const existing = await prisma.contextDocument.findFirst({ where: { id: contextId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  if (existing.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can modify this document." } });
  }

  const rows = parsedBody.data.variables.map((item) => ({
    contextId,
    key: item.key.trim(),
    label: item.label?.trim() || null,
    defaultValue: typeof item.defaultValue === "string" ? item.defaultValue : null,
    required: item.required ?? false,
  }));

  const transactionSteps = [prisma.contextVariable.deleteMany({ where: { contextId } })];
  if (rows.length > 0) {
    transactionSteps.push(prisma.contextVariable.createMany({ data: rows }));
  }
  await prisma.$transaction(transactionSteps);

  const doc = await prisma.contextDocument.findFirst({
    where: { id: contextId, teamId: auth.teamId },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true, ou: true } },
      variables: { select: { id: true, key: true, label: true, defaultValue: true, required: true } },
    },
  });

  if (!doc) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }
  if (!canAccessByVisibility(doc, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this document." } });
  }

  return res.status(200).json({ data: serializeContextDoc(doc) });
});

contextRouter.delete("/:id", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const docId = parsedParams.data.id;
  const existing = await prisma.contextDocument.findFirst({ where: { id: docId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  if (existing.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can archive this document." } });
  }

  const archived = await prisma.contextDocument.update({
    where: { id: docId },
    data: { status: "ARCHIVED" },
  });

  return res.status(200).json({ data: archived });
});

contextRouter.delete("/:id/permanent", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const contextId = parsedParams.data.id;
  const existing = await prisma.contextDocument.findFirst({ where: { id: contextId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  if (existing.ownerId !== auth.userId) {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Only the owner can permanently delete this context file." },
    });
  }

  await prisma.$transaction([
    prisma.contextUsageEvent.deleteMany({ where: { contextId } }),
    prisma.contextFavorite.deleteMany({ where: { contextId } }),
    prisma.contextRating.deleteMany({ where: { contextId } }),
    prisma.contextVariable.deleteMany({ where: { contextId } }),
    prisma.contextVersion.deleteMany({ where: { contextId } }),
    prisma.collectionContext.deleteMany({ where: { contextId } }),
    prisma.contextDocument.delete({ where: { id: contextId } }),
  ]);

  return res.status(200).json({ data: { deleted: true, id: contextId } });
});

contextRouter.post("/:id/favorite", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const contextId = parsedParams.data.id;
  const doc = await prisma.contextDocument.findUnique({
    where: { id: contextId },
    select: {
      id: true,
      teamId: true,
      ownerId: true,
      visibility: true,
      owner: { select: { ou: true } },
    },
  });
  if (!doc) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }
  if (!canAccessByVisibility(doc, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this document." } });
  }

  const existing = await prisma.contextFavorite.findUnique({
    where: { contextId_userId: { contextId, userId: auth.userId } },
  });
  if (existing) {
    await prisma.contextFavorite.delete({ where: { contextId_userId: { contextId, userId: auth.userId } } });
    return res.status(200).json({ data: { favorited: false } });
  }
  await prisma.contextFavorite.create({ data: { contextId, userId: auth.userId } });
  return res.status(200).json({ data: { favorited: true } });
});

contextRouter.post("/:id/usage", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const parsedBody = usageBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const contextId = parsedParams.data.id;
  const { eventType } = parsedBody.data;

  const doc = await prisma.contextDocument.findUnique({
    where: { id: contextId },
    select: {
      id: true,
      teamId: true,
      ownerId: true,
      visibility: true,
      owner: { select: { ou: true } },
    },
  });
  if (!doc) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }
  if (!canAccessByVisibility(doc, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this document." } });
  }

  await prisma.contextUsageEvent.create({ data: { contextId, userId: auth.userId, eventType } });
  return res.status(200).json({ data: { ok: true } });
});

const ratingBodySchema = z.object({
  value: z.number().int().min(1).max(5),
});

contextRouter.post("/:id/rating", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const parsedBody = ratingBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const contextId = parsedParams.data.id;
  const { value } = parsedBody.data;

  const doc = await prisma.contextDocument.findUnique({
    where: { id: contextId },
    select: {
      id: true,
      teamId: true,
      ownerId: true,
      visibility: true,
      owner: { select: { ou: true } },
    },
  });
  if (!doc) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }
  if (!canAccessByVisibility(doc, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this document." } });
  }
  if (doc.ownerId === auth.userId) {
    return res
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "You can't rate your own context document." } });
  }

  await prisma.contextRating.upsert({
    where: { userId_contextId: { userId: auth.userId, contextId } },
    update: { value },
    create: { userId: auth.userId, contextId, value },
  });

  return res.status(200).json({ data: { ok: true, value } });
});

contextRouter.post("/:id/regenerate-thumbnail", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const contextId = parsedParams.data.id;
  const existing = await prisma.contextDocument.findFirst({ where: { id: contextId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  if (existing.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can modify this document." } });
  }

  const queued = await prisma.contextDocument.update({
    where: { id: contextId },
    data: {
      thumbnailStatus: "PENDING",
      thumbnailError: null,
    },
  });

  void queueContextThumbnailGeneration(contextId);

  return res.status(202).json({
    data: {
      id: queued.id,
      thumbnailStatus: queued.thumbnailStatus as ThumbnailStatusValue,
    },
  });
});

const collectionContextParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  collectionId: z.coerce.number().int().positive(),
});

contextRouter.post("/:id/collections/:collectionId", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = collectionContextParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const contextId = parsedParams.data.id;
  const collectionId = parsedParams.data.collectionId;

  const [doc, collection] = await Promise.all([
    prisma.contextDocument.findFirst({ where: { id: contextId, teamId: auth.teamId }, select: { id: true } }),
    prisma.collection.findFirst({ where: { id: collectionId, teamId: auth.teamId }, select: { id: true } }),
  ]);

  if (!doc || !collection) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document or collection not found." } });
  }

  const maxSort = await prisma.collectionContext.aggregate({
    where: { collectionId },
    _max: { sortOrder: true },
  });

  const linked = await prisma.collectionContext.upsert({
    where: { collectionId_contextId: { collectionId, contextId } },
    create: {
      collectionId,
      contextId,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    update: {},
  });

  return res.status(200).json({ data: linked });
});

contextRouter.delete("/:id/collections/:collectionId", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = collectionContextParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const contextId = parsedParams.data.id;
  const collectionId = parsedParams.data.collectionId;

  const existing = await prisma.collectionContext.findFirst({
    where: {
      collectionId,
      contextId,
      collection: { teamId: auth.teamId },
    },
  });

  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not in this collection." } });
  }

  await prisma.collectionContext.delete({ where: { collectionId_contextId: { collectionId, contextId } } });
  return res.status(200).json({ data: { ok: true } });
});

contextRouter.get("/:id/versions", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const contextId = parsedParams.data.id;
  const doc = await prisma.contextDocument.findUnique({
    where: { id: contextId },
    select: {
      id: true,
      teamId: true,
      ownerId: true,
      visibility: true,
      owner: { select: { ou: true } },
    },
  });
  if (!doc) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }
  if (!canAccessByVisibility(doc, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this document." } });
  }

  const versions = await prisma.contextVersion.findMany({
    where: { contextId },
    orderBy: { version: "desc" },
  });

  return res.status(200).json({ data: versions });
});

const contextRestoreParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  version: z.coerce.number().int().positive(),
});

contextRouter.post("/:id/restore/:version", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextRestoreParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const contextId = parsedParams.data.id;
  const targetVersion = parsedParams.data.version;

  const doc = await prisma.contextDocument.findFirst({ where: { id: contextId, teamId: auth.teamId } });
  if (!doc) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  if (doc.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can restore this document." } });
  }

  const version = await prisma.contextVersion.findFirst({ where: { contextId, version: targetVersion } });
  if (!version) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context version not found." } });
  }

  const updated = await prisma.contextDocument.update({
    where: { id: contextId },
    data: {
      body: version.body,
      supportUrl: version.supportUrl,
    },
  });

  return res.status(200).json({ data: updated });
});

export { contextRouter };
