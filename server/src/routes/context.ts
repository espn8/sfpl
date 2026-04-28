import type { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import {
  getAuthContext,
  requireAuth,
  requireOnboardingComplete,
  requireWriteAccess,
  type AuthContext,
} from "../middleware/auth";
import { ownerNameSearchClause } from "../lib/assetSearch";
import { canViewAssetInTeamCatalog } from "../lib/catalogAsset";
import { prisma } from "../lib/prisma";
import {
  logManualArchive,
  transferOwner,
  unarchiveAsset,
  verifyAsset,
} from "../services/governanceOps";
import { countFlags, didNotWorkRate } from "../services/scoring";
import {
  buildVisibilityWhereFragment,
  canAccessByVisibility as sharedCanAccessByVisibility,
  canMutateTeamScopedAsset,
  isOwnerOrWorkspaceAdmin,
} from "../lib/visibility";
import { generatePromptThumbnail } from "../services/nanoBanana";
import {
  checkContextDuplicates,
  computeBodyHash,
  normalizeTitle,
  formatDuplicateError,
} from "../services/dedup";
import {
  SUMMARY_MAX_CHARS,
  SUMMARY_TOO_LONG_MESSAGE,
  checkUpdatedSummaryLength,
} from "../lib/summaryLimits";
import { getWeekTopAssetKeySet, weekTopAssetKey } from "../services/weekTopAssets";
import { validateTagIdsExist, contextTaggedWithWhere } from "../lib/assetTags";

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
  tag: z.string().trim().optional(),
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

const feedbackFlagSchema = z.enum(["WORKED_WELL", "DID_NOT_WORK", "INACCURATE", "OUTDATED", "OFF_TOPIC"]);
const transferOwnerBodySchema = z.object({
  newOwnerId: z.number().int().positive(),
  reason: z.string().trim().max(500).optional(),
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
    summary: z.string().trim().max(SUMMARY_MAX_CHARS, SUMMARY_TOO_LONG_MESSAGE).optional(),
    body: z.string().min(1, "body is required.").max(MAX_BODY_LENGTH, "body is too long."),
    supportUrl: z.string().url("supportUrl must be a valid URL.").optional().or(z.literal("")),
    visibility: promptVisibilitySchema.optional(),
    status: promptStatusSchema.optional(),
    tools: z.array(z.union([contextToolSchema, z.string()])).optional(),
    variables: z.array(contextVariableItemSchema).max(40).optional(),
    tagIds: z.array(z.coerce.number().int().positive()).max(50).optional(),
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
    tagIds: z.array(z.coerce.number().int().positive()).max(50).optional(),
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
contextRouter.use(requireOnboardingComplete);

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
  const tag = parsedQuery.data.tag ?? "";
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
    if (status) {
      where.status = status;
    }
  } else {
    whereAnd.push(buildVisibilityWhereFragment(auth) as Prisma.ContextDocumentWhereInput);
    where.status = "PUBLISHED";
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
        ownerNameSearchClause(q),
      ],
    });
  }
  if (tag) {
    whereAnd.push(contextTaggedWithWhere(tag));
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
  const weekTopKeys = await getWeekTopAssetKeySet(auth.teamId);

  if (includeAnalytics && rows.length > 0) {
    const contextIds = rows.map((r) => r.id);
    const [viewCounts, copyCounts, favoriteCounts, ratingData, ratingFlagRows] = await Promise.all([
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
      prisma.contextRating.findMany({
        where: { contextId: { in: contextIds } },
        select: { contextId: true, feedbackFlags: true },
      }),
    ]);

    const viewMap = new Map(viewCounts.map((v) => [v.contextId, v._count.contextId]));
    const copyMap = new Map(copyCounts.map((c) => [c.contextId, c._count.contextId]));
    const favoriteMap = new Map(favoriteCounts.map((f) => [f.contextId, f._count.contextId]));
    const ratingMap = new Map(ratingData.map((r) => [r.contextId, { count: r._count.contextId, avg: r._avg.value }]));
    const flagRowsByContext = new Map<number, Array<{ feedbackFlags: string[] }>>();
    for (const row of ratingFlagRows) {
      const list = flagRowsByContext.get(row.contextId) ?? [];
      list.push({ feedbackFlags: row.feedbackFlags });
      flagRowsByContext.set(row.contextId, list);
    }

    const dataWithAnalytics = rows.map((row) => {
      const ratingInfo = ratingMap.get(row.id);
      const flagRows = flagRowsByContext.get(row.id) ?? [];
      return {
        ...serializeContextDoc(row),
        viewCount: viewMap.get(row.id) ?? 0,
        copyCount: copyMap.get(row.id) ?? 0,
        favoriteCount: favoriteMap.get(row.id) ?? 0,
        ratingCount: ratingInfo?.count ?? 0,
        averageRating: ratingInfo?.avg ?? null,
        flagCounts: countFlags(flagRows),
        didNotWorkRate: didNotWorkRate(flagRows),
        isTopAssetThisWeek: weekTopKeys.has(weekTopAssetKey("context", row.id)),
      };
    });

    return res.status(200).json({
      data: dataWithAnalytics,
      meta: { page, pageSize, total, totalPages },
    });
  }

  return res.status(200).json({
    data: rows.map((row) => ({
      ...serializeContextDoc(row),
      isTopAssetThisWeek: weekTopKeys.has(weekTopAssetKey("context", row.id)),
    })),
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

  const { title, summary, body, supportUrl, visibility, status, tools, variables, tagIds } = parsedBody.data;

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

  if (tagIds && tagIds.length > 0) {
    const ok = await validateTagIdsExist(tagIds);
    if (!ok) {
      await prisma.contextDocument.delete({ where: { id: doc.id } });
      return res.status(400).json({
        error: { code: "BAD_REQUEST", message: "One or more tags are invalid." },
      });
    }
    await prisma.contextTag.createMany({
      data: [...new Set(tagIds)].map((tid) => ({ contextId: doc.id, tagId: tid })),
    });
  }

  const docOut = await prisma.contextDocument.findUnique({
    where: { id: doc.id },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
      variables: { select: { id: true, key: true, label: true, defaultValue: true, required: true } },
      contextTags: { include: { tag: true } },
    },
  });

  if (!docOut) {
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Create failed." } });
  }
  const { contextTags, ...docRest } = docOut;

  return res.status(201).json({
    data: {
      ...serializeContextDoc(docRest as typeof docOut),
      thumbnailStatus: docOut.thumbnailStatus as ThumbnailStatusValue,
      tags: (contextTags ?? []).map((item: { tag: { name: string } }) => item.tag.name),
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
      contextTags: { include: { tag: true } },
    },
  });

  if (!doc) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }
  if (!canAccessByVisibility(doc, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this document." } });
  }
  if (!canViewAssetInTeamCatalog(doc.status, doc.ownerId, auth.userId)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  const [viewCount, copyCount, favoriteCount, favoriteRow, myRatingRow, ratings, weekTopKeys] = await Promise.all([
    prisma.contextUsageEvent.count({ where: { contextId, eventType: "VIEW" } }),
    prisma.contextUsageEvent.count({ where: { contextId, eventType: "COPY" } }),
    prisma.contextFavorite.count({ where: { contextId } }),
    prisma.contextFavorite.findUnique({ where: { contextId_userId: { contextId, userId: auth.userId } } }),
    prisma.contextRating.findUnique({ where: { userId_contextId: { userId: auth.userId, contextId } } }),
    prisma.contextRating.findMany({ where: { contextId }, select: { value: true, feedbackFlags: true } }),
    getWeekTopAssetKeySet(doc.teamId),
  ]);

  const averageRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.value, 0) / ratings.length
    : null;

  const { contextTags, ...docRest } = doc;

  return res.status(200).json({
    data: {
      ...serializeContextDoc(docRest as typeof doc),
      thumbnailStatus: doc.thumbnailStatus as ThumbnailStatusValue,
      tags: (contextTags ?? []).map((item: { tag: { name: string } }) => item.tag.name),
      viewCount,
      copyCount,
      favoriteCount,
      favorited: Boolean(favoriteRow),
      myRating: myRatingRow?.value ?? null,
      ratings: ratings.map((r) => ({ value: r.value })),
      averageRating,
      ratingCount: ratings.length,
      flagCounts: countFlags(ratings),
      didNotWorkRate: didNotWorkRate(ratings),
      isTopAssetThisWeek: weekTopKeys.has(weekTopAssetKey("context", doc.id)),
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
  const existing = await prisma.contextDocument.findUnique({ where: { id: contextId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  if (!canMutateTeamScopedAsset(existing, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can modify this document." } });
  }

  if (parsedBody.data.tagIds !== undefined && auth.userId !== existing.ownerId) {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Only the asset owner can change tags." },
    });
  }

  const u = parsedBody.data;
  const nextSummaryInput = typeof u.summary === "string" ? u.summary.trim() : undefined;
  const summaryCheck = checkUpdatedSummaryLength(nextSummaryInput, existing.summary);
  if (!summaryCheck.ok) {
    return res.status(400).json({
      error: { code: "BAD_REQUEST", message: summaryCheck.message },
    });
  }
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
      contextTags: { include: { tag: true } },
    },
  });

  if (u.tagIds !== undefined) {
    const uniqueTagIds = [...new Set(u.tagIds)];
    if (uniqueTagIds.length > 0) {
      const ok = await validateTagIdsExist(uniqueTagIds);
      if (!ok) {
        return res.status(400).json({
          error: { code: "BAD_REQUEST", message: "One or more tags are invalid." },
        });
      }
    }
    const steps: Prisma.PrismaPromise<unknown>[] = [prisma.contextTag.deleteMany({ where: { contextId } })];
    if (uniqueTagIds.length > 0) {
      steps.push(
        prisma.contextTag.createMany({
          data: uniqueTagIds.map((tagId) => ({ contextId, tagId })),
        }),
      );
    }
    await prisma.$transaction(steps);
  }

  const out = await prisma.contextDocument.findUnique({
    where: { id: contextId },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
      variables: { select: { id: true, key: true, label: true, defaultValue: true, required: true } },
      contextTags: { include: { tag: true } },
    },
  });
  if (!out) {
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Update failed." } });
  }
  const { contextTags: outTags, ...outRest } = out;

  return res.status(200).json({
    data: {
      ...serializeContextDoc(outRest as typeof out),
      tags: (outTags ?? []).map((item: { tag: { name: string } }) => item.tag.name),
    },
  });
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
  const existing = await prisma.contextDocument.findUnique({ where: { id: contextId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  if (!canMutateTeamScopedAsset(existing, auth)) {
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

  const doc = await prisma.contextDocument.findUnique({
    where: { id: contextId },
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
  const existing = await prisma.contextDocument.findUnique({ where: { id: docId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  if (!canMutateTeamScopedAsset(existing, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can archive this document." } });
  }

  await prisma.contextDocument.update({
    where: { id: docId },
    data: { status: "ARCHIVED" },
  });
  await logManualArchive("CONTEXT", docId, auth.userId);
  const archived = await prisma.contextDocument.findUnique({ where: { id: docId } });

  return res.status(200).json({ data: archived });
});

contextRouter.post("/:id/verify", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const docId = parsedParams.data.id;
  const existing = await prisma.contextDocument.findUnique({ where: { id: docId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }
  if (!isOwnerOrWorkspaceAdmin(existing.ownerId, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can verify this document." } });
  }
  await verifyAsset("CONTEXT", docId, auth.userId);
  const updated = await prisma.contextDocument.findUnique({ where: { id: docId } });
  return res.status(200).json({ data: updated });
});

contextRouter.post("/:id/unarchive", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const docId = parsedParams.data.id;
  const existing = await prisma.contextDocument.findUnique({ where: { id: docId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }
  if (!isOwnerOrWorkspaceAdmin(existing.ownerId, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can unarchive this document." } });
  }
  await unarchiveAsset("CONTEXT", docId, auth.userId);
  const updated = await prisma.contextDocument.findUnique({ where: { id: docId } });
  return res.status(200).json({ data: updated });
});

contextRouter.post("/:id/transfer-owner", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  if (auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only admins can transfer ownership." } });
  }
  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = transferOwnerBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }
  const docId = parsedParams.data.id;
  const { newOwnerId, reason } = parsedBody.data;
  const existing = await prisma.contextDocument.findUnique({ where: { id: docId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }
  const newOwner = await prisma.user.findUnique({ where: { id: newOwnerId }, select: { id: true, teamId: true } });
  if (!newOwner || newOwner.teamId !== existing.teamId) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "New owner must be a user on the same team." } });
  }
  await transferOwner("CONTEXT", docId, auth.userId, newOwnerId, reason);
  const updated = await prisma.contextDocument.findUnique({ where: { id: docId } });
  return res.status(200).json({ data: updated });
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
  const existing = await prisma.contextDocument.findUnique({ where: { id: contextId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  if (!isOwnerOrWorkspaceAdmin(existing.ownerId, auth)) {
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
      status: true,
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
  if (!canViewAssetInTeamCatalog(doc.status, doc.ownerId, auth.userId)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
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
      status: true,
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
  if (!canViewAssetInTeamCatalog(doc.status, doc.ownerId, auth.userId)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  if (eventType === "COPY") {
    await prisma.$transaction([
      prisma.contextUsageEvent.create({ data: { contextId, userId: auth.userId, eventType } }),
      prisma.contextDocument.update({ where: { id: contextId }, data: { usageCount: { increment: 1 } } }),
    ]);
  } else {
    await prisma.contextUsageEvent.create({ data: { contextId, userId: auth.userId, eventType } });
  }
  return res.status(200).json({ data: { ok: true } });
});

const ratingBodySchema = z.object({
  value: z.number().int().min(1).max(5),
  feedbackFlags: z.array(feedbackFlagSchema).max(4).optional(),
  comment: z.string().max(500).optional(),
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
      status: true,
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
  if (!canViewAssetInTeamCatalog(doc.status, doc.ownerId, auth.userId)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
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
  const existing = await prisma.contextDocument.findUnique({ where: { id: contextId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  if (!canMutateTeamScopedAsset(existing, auth)) {
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
      status: true,
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
  if (!canViewAssetInTeamCatalog(doc.status, doc.ownerId, auth.userId)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
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

  const doc = await prisma.contextDocument.findUnique({ where: { id: contextId } });
  if (!doc) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  if (!canMutateTeamScopedAsset(doc, auth)) {
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
