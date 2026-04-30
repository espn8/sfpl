import { Prisma, PromptModality, UsageAction } from "@prisma/client";
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
import { countFlags } from "../lib/flagCounts";
import {
  buildVisibilityWhereFragment,
  canAccessByVisibility,
  canMutateTeamScopedAsset,
  isOwnerOrWorkspaceAdmin,
} from "../lib/visibility";
import { generatePromptThumbnail } from "../services/nanoBanana";
import { refreshBestOfCollection, refreshToolCollection } from "../services/systemCollections";
import { getWeekTopAssetKeySet, weekTopAssetKey } from "../services/weekTopAssets";
import { thumbnailRefFor } from "./thumbnails";
import { notifySlackIfEnteredPublicPublished } from "../services/slackNewPublicAsset";
import {
  checkPromptDuplicates,
  computeBodyHash,
  normalizeTitle,
  formatDuplicateError,
} from "../services/dedup";
import { validateTagIdsExist } from "../lib/assetTags";
import { apiModalitySchema, apiToDbModality, mapDbModalityToApi, type ApiModality } from "../lib/modality";
import {
  SUMMARY_MAX_CHARS,
  SUMMARY_TOO_LONG_MESSAGE,
  checkUpdatedSummaryLength,
} from "../lib/summaryLimits";

const promptsRouter = Router();

type PromptSort = "recent" | "topRated" | "mostUsed";
type PromptStatusValue = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type UsageActionValue = "VIEW" | "COPY" | "LAUNCH";
type ThumbnailStatusValue = "PENDING" | "READY" | "FAILED";
const USAGE_ACTIONS: UsageActionValue[] = ["VIEW", "COPY", "LAUNCH"];
const promptVisibilitySchema = z.enum(["PUBLIC", "TEAM", "PRIVATE"]);
const promptStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const usageActionSchema = z.enum(USAGE_ACTIONS);
const PROMPT_TOOLS = ["agentforce_vibes", "chatgpt", "claude_code", "claude_cowork", "cursor", "gemini", "meshmesh", "notebooklm", "other", "saleo", "slackbot"] as const;
const promptToolSchema = z.enum(PROMPT_TOOLS);

const ASSET_TYPES = ["prompt", "skill", "context"] as const;
const assetTypeSchema = z.enum(ASSET_TYPES);
type AssetType = (typeof ASSET_TYPES)[number];

function mapLegacyModelHintToTools(modelHint?: string | null): string[] {
  const value = modelHint?.trim().toLowerCase();
  if (!value) {
    return [];
  }
  if (value === "chatgpt" || value === "chat gpt" || value === "gpt" || value === "openai") {
    return ["chatgpt"];
  }
  if (value === "cursor") {
    return ["cursor"];
  }
  if (value === "claude code" || value === "claude_code" || value === "claudecode" || value === "claude") {
    return ["claude_code"];
  }
  if (value === "claude cowork" || value === "claude_cowork" || value === "claudecowork" || value === "cowork") {
    return ["claude_cowork"];
  }
  if (value === "meshmesh") {
    return ["meshmesh"];
  }
  if (value === "slackbot" || value === "slack bot") {
    return ["slackbot"];
  }
  if (value === "gemini") {
    return ["gemini"];
  }
  if (value === "notebooklm" || value === "notebook lm") {
    return ["notebooklm"];
  }
  return [];
}

function isMissingColumnError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022"
  );
}

const listPromptsQuerySchema = z.object({
  q: z.string().trim().optional(),
  collectionId: z.coerce.number().int().positive().optional(),
  tag: z.string().trim().optional(),
  status: promptStatusSchema.optional(),
  tool: promptToolSchema.optional(),
  modality: apiModalitySchema.optional(),
  types: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const parsed = val.split(",").map((t) => t.trim().toLowerCase());
      return parsed.filter((t): t is AssetType => ASSET_TYPES.includes(t as AssetType));
    }),
  sort: z.enum(["recent", "topRated", "mostUsed"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  mine: z.coerce.boolean().optional(),
});

const promptIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const promptRestoreParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  version: z.coerce.number().int().positive(),
});

const promptVariableItemSchema = z.object({
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

const replacePromptVariablesBodySchema = z
  .object({
    variables: z.array(promptVariableItemSchema).max(40, "too many variables."),
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

const createPromptBodySchema = z
  .object({
    title: z.string().trim().min(1, "title is required."),
    summary: z.string().trim().max(SUMMARY_MAX_CHARS, SUMMARY_TOO_LONG_MESSAGE).optional(),
    body: z.string().min(1, "body is required."),
    visibility: promptVisibilitySchema.optional(),
    status: promptStatusSchema.optional(),
    tools: z.array(promptToolSchema).min(1, "at least one tool is required."),
    modality: apiModalitySchema,
    modelHint: z.string().trim().optional(),
    variables: z.array(promptVariableItemSchema).max(40).optional(),
    tagIds: z
      .array(z.coerce.number().int().positive())
      .min(1, "At least one tag is required.")
      .max(50),
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

const updatePromptBodySchema = z
  .object({
    title: z.string().trim().optional(),
    summary: z.string().trim().optional(),
    body: z.string().optional(),
    visibility: promptVisibilitySchema.optional(),
    status: promptStatusSchema.optional(),
    tools: z.array(promptToolSchema).min(1).optional(),
    modality: apiModalitySchema.optional(),
    modelHint: z.union([z.string(), z.null()]).optional(),
    changelog: z.string().optional(),
    tagIds: z.array(z.coerce.number().int().positive()).max(50).optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one field must be provided.",
  );

const feedbackFlagSchema = z.enum(["WORKED_WELL", "DID_NOT_WORK", "INACCURATE", "OUTDATED", "OFF_TOPIC"]);
const ratingBodySchema = z.object({
  value: z.number().int().min(1).max(5),
  feedbackFlags: z.array(feedbackFlagSchema).max(4).optional(),
  comment: z.string().max(500).optional(),
});

const transferOwnerBodySchema = z.object({
  newOwnerId: z.number().int().positive(),
  reason: z.string().trim().max(500).optional(),
});

const usageBodySchema = z.object({
  action: usageActionSchema,
});

const createPromptVersionBodySchema = z.object({
  body: z.string().min(1, "body is required."),
  changelog: z.string().optional(),
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

function parseSort(value: unknown): PromptSort {
  if (value === "topRated" || value === "mostUsed") {
    return value;
  }
  return "recent";
}

function serializePromptWithModality<
  T extends Record<string, unknown> & { modality: PromptModality; tools: string[]; modelHint?: string | null },
>(prompt: T): Omit<T, "modality" | "tools"> & { tools: string[]; modality: ApiModality } {
  return {
    ...prompt,
    tools: prompt.tools.length > 0 ? prompt.tools : mapLegacyModelHintToTools(prompt.modelHint),
    modality: mapDbModalityToApi(prompt.modality),
  };
}

function scheduleSystemCollectionRefresh(teamId: number, tools: string[]) {
  setImmediate(async () => {
    try {
      for (const tool of tools) {
        await refreshToolCollection(teamId, tool);
      }
      await refreshBestOfCollection(teamId);
    } catch (error) {
      console.error("Failed to refresh system collections:", error);
    }
  });
}

function canAccessPromptByVisibility(
  prompt: { teamId: number; visibility: string; ownerId: number; owner?: { ou: string | null } | null },
  auth: AuthContext,
): boolean {
  return canAccessByVisibility(prompt, auth);
}

async function queuePromptThumbnailGeneration(promptId: number) {
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: { id: true, title: true, summary: true, body: true },
  });
  if (!prompt) {
    console.warn(`[Thumbnail] Prompt ${promptId} not found, skipping thumbnail generation.`);
    return;
  }

  console.log(`[Thumbnail] Starting generation for prompt ${promptId}: "${prompt.title}"`);

  try {
    const thumbnailUrl = await generatePromptThumbnail({
      title: prompt.title,
      summary: prompt.summary,
      body: prompt.body,
    });
    await prisma.prompt.update({
      where: { id: promptId },
      data: {
        thumbnailUrl,
        thumbnailStatus: "READY",
        thumbnailError: null,
      },
    });
    console.log(`[Thumbnail] Successfully generated thumbnail for prompt ${promptId}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.slice(0, 400) : "Unknown thumbnail generation error.";
    console.error(`[Thumbnail] Failed to generate thumbnail for prompt ${promptId}:`, message);
    await prisma.prompt.update({
      where: { id: promptId },
      data: {
        thumbnailStatus: "FAILED",
        thumbnailError: message,
      },
    });
  }
}

promptsRouter.use(requireAuth);
promptsRouter.use(requireOnboardingComplete);

promptsRouter.get("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedQuery = listPromptsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json(badRequestFromZodError(parsedQuery.error));
  }

  const q = parsedQuery.data.q ?? "";
  const collectionId = parsedQuery.data.collectionId;
  const tag = parsedQuery.data.tag;
  const status = parsedQuery.data.status;
  const tool = parsedQuery.data.tool;
  const modality = parsedQuery.data.modality;
  const types = parsedQuery.data.types;
  const sort = parseSort(parsedQuery.data.sort);
  const page = parsedQuery.data.page ?? 1;
  const pageSize = parsedQuery.data.pageSize ?? 20;
  const skip = (page - 1) * pageSize;
  const mine = parsedQuery.data.mine;

  const includePrompts = !types || types.length === 0 || types.includes("prompt");
  const includeSkills = types?.includes("skill") ?? false;
  const includeContext = types?.includes("context") ?? false;

  const where: Prisma.PromptWhereInput = {};
  const whereAnd: Prisma.PromptWhereInput[] = [];
  if (mine) {
    where.ownerId = auth.userId;
    where.teamId = auth.teamId;
    if (status) {
      where.status = status;
    }
  } else {
    whereAnd.push(buildVisibilityWhereFragment(auth) as Prisma.PromptWhereInput);
    where.status = "PUBLISHED";
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
    where.promptTags = { some: { tag: { name: { equals: tag, mode: "insensitive" } } } };
  }
  if (collectionId) {
    where.collections = { some: { collectionId } };
  }
  if (tool) {
    where.tools = { has: tool };
  }
  if (modality) {
    where.modality = apiToDbModality[modality];
  }
  if (whereAnd.length > 0) {
    where.AND = whereAnd;
  }

  const orderBy: Prisma.PromptOrderByWithRelationInput =
    sort === "topRated"
      ? { ratings: { _count: "desc" as const } }
      : sort === "mostUsed"
        ? { usageEvents: { _count: "desc" as const } }
        : { createdAt: "desc" as const };

  const publishedSnapshotWhere: Prisma.PromptWhereInput = {
    status: "PUBLISHED",
    AND: [buildVisibilityWhereFragment(auth) as Prisma.PromptWhereInput],
  };

  // If types filter excludes prompts and only requests skill/context (not yet supported in unified results),
  // return empty results for now. Skills and Context will be integrated in a future update.
  if (!includePrompts && (includeSkills || includeContext)) {
    return res.status(200).json({
      data: [],
      meta: {
        page,
        pageSize,
        total: 0,
        totalPages: 1,
        snapshot: { promptsPublished: 0, activeUsers: 0, promptsUsed: 0 },
      },
    });
  }

  const [prompts, total, promptsPublished, activeUsers, promptsUsed] = await Promise.all([
    prisma.prompt.findMany({
      where,
      select: {
        id: true,
        title: true,
        summary: true,
        body: true,
        status: true,
        visibility: true,
        modelHint: true,
        tools: true,
        modality: true,
        thumbnailStatus: true,
        isSmartPick: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, avatarUrl: true } },
        variables: { select: { key: true, label: true, defaultValue: true, required: true } },
        _count: { select: { favorites: true, ratings: true, usageEvents: true } },
        ratings: { select: { value: true, feedbackFlags: true } },
        promptTags: { include: { tag: true } },
      },
      orderBy,
      skip,
      take: pageSize,
    }),
    prisma.prompt.count({ where }),
    prisma.prompt.count({ where: publishedSnapshotWhere }),
    prisma.user.count({ where: { teamId: auth.teamId } }),
    prisma.usageEvent.count({
      where: {
        action: { in: [UsageAction.COPY, UsageAction.LAUNCH] },
        prompt: { teamId: auth.teamId },
      },
    }),
  ]).catch(async (error: unknown) => {
    // Backward-compatible fallback for databases missing newer Prompt columns.
    if (!isMissingColumnError(error)) {
      throw error;
    }

    const [legacyPrompts, legacyTotal, legacyPublished, legacyUsers, legacyUsed] = await Promise.all([
      prisma.prompt.findMany({
        where,
        select: {
          id: true,
          title: true,
          summary: true,
          body: true,
          status: true,
          visibility: true,
          modelHint: true,
          createdAt: true,
          updatedAt: true,
          owner: { select: { id: true, name: true, avatarUrl: true } },
          variables: { select: { key: true, label: true, defaultValue: true, required: true } },
          _count: { select: { favorites: true, ratings: true, usageEvents: true } },
          ratings: { select: { value: true, feedbackFlags: true } },
          promptTags: { include: { tag: true } },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.prompt.count({ where }),
      prisma.prompt.count({ where: publishedSnapshotWhere }),
      prisma.user.count({ where: { teamId: auth.teamId } }),
      prisma.usageEvent.count({
        where: {
          action: { in: [UsageAction.COPY, UsageAction.LAUNCH] },
          prompt: { teamId: auth.teamId },
        },
      }),
    ]);
    return [legacyPrompts, legacyTotal, legacyPublished, legacyUsers, legacyUsed] as const;
  });

  type ListedPromptRow = {
    id: number;
    title: string;
    summary: string | null;
    body?: string;
    status: string;
    visibility: string;
    modelHint?: string | null;
    tools?: string[];
    modality?: PromptModality;
    thumbnailStatus?: string;
    isSmartPick?: boolean;
    lastVerifiedAt?: Date | null;
    verificationDueAt?: Date | null;
    archivedAt?: Date | null;
    archiveReason?: string | null;
    createdAt: Date;
    updatedAt: Date;
    owner: { id: number; name: string | null; avatarUrl: string | null };
    ratings: Array<{ value: number; feedbackFlags: string[] }>;
    promptTags: { tag: { name: string } }[];
    _count: { favorites: number; ratings: number; usageEvents: number };
    variables?: Array<{ key: string; label: string | null; defaultValue: string | null; required: boolean }>;
  };

  const listed = prompts as ListedPromptRow[];
  const promptIds = listed.map((row) => row.id);
  let viewCountByPrompt = new Map<number, number>();
  let usageCountByPrompt = new Map<number, number>();
  let favoritedPromptIds = new Set<number>();
  let myRatingByPrompt = new Map<number, number>();
  if (promptIds.length > 0) {
    const [viewGroups, usageGroups, favoriteRows, ratingRows] = await Promise.all([
      prisma.usageEvent.groupBy({
        by: ["promptId"],
        where: { promptId: { in: promptIds }, action: UsageAction.VIEW },
        _count: { _all: true },
      }),
      prisma.usageEvent.groupBy({
        by: ["promptId"],
        where: { promptId: { in: promptIds }, action: { in: [UsageAction.COPY, UsageAction.LAUNCH] } },
        _count: { _all: true },
      }),
      prisma.favorite.findMany({
        where: { userId: auth.userId, promptId: { in: promptIds } },
        select: { promptId: true },
      }),
      prisma.rating.findMany({
        where: { userId: auth.userId, promptId: { in: promptIds } },
        select: { promptId: true, value: true },
      }),
    ]);
    viewCountByPrompt = new Map(viewGroups.map((group) => [group.promptId, group._count._all]));
    usageCountByPrompt = new Map(usageGroups.map((group) => [group.promptId, group._count._all]));
    favoritedPromptIds = new Set(favoriteRows.map((row) => row.promptId));
    myRatingByPrompt = new Map(ratingRows.map((row) => [row.promptId, row.value]));
  }

  const data = listed.map((prompt) => ({
    id: prompt.id,
    type: "prompt" as const,
    title: prompt.title,
    summary: prompt.summary,
    body: typeof prompt.body === "string" ? prompt.body : "",
    status: prompt.status,
    visibility: prompt.visibility,
    tools:
      "tools" in prompt && Array.isArray(prompt.tools) && prompt.tools.length > 0
        ? prompt.tools
        : mapLegacyModelHintToTools(prompt.modelHint),
    modality: prompt.modality !== undefined ? mapDbModalityToApi(prompt.modality) : "text",
    modelHint: prompt.modelHint,
    thumbnailUrl: thumbnailRefFor(
      "prompt",
      prompt.id,
      "thumbnailStatus" in prompt ? (prompt.thumbnailStatus as string | undefined) : undefined,
      prompt.updatedAt,
    ),
    thumbnailStatus: "thumbnailStatus" in prompt ? (prompt.thumbnailStatus as ThumbnailStatusValue) : "PENDING",
    createdAt: prompt.createdAt,
    updatedAt: prompt.updatedAt,
    tags: (prompt.promptTags ?? []).map((item: { tag: { name: string } }) => item.tag.name),
    favoriteCount: prompt._count.favorites,
    ratingCount: prompt._count.ratings,
    usageCount: usageCountByPrompt.get(prompt.id) ?? 0,
    averageRating:
      prompt.ratings.length === 0
        ? null
        : prompt.ratings.reduce((sum: number, item: { value: number }) => sum + item.value, 0) / prompt.ratings.length,
    flagCounts: countFlags(prompt.ratings),
    lastVerifiedAt: "lastVerifiedAt" in prompt ? prompt.lastVerifiedAt : null,
    verificationDueAt: "verificationDueAt" in prompt ? prompt.verificationDueAt : null,
    archivedAt: "archivedAt" in prompt ? prompt.archivedAt : null,
    archiveReason: "archiveReason" in prompt ? prompt.archiveReason : null,
    variables: Array.isArray(prompt.variables)
      ? prompt.variables.map((item) => ({
          key: item.key,
          label: item.label,
          defaultValue: item.defaultValue,
          required: item.required,
        }))
      : [],
    owner: {
      id: prompt.owner.id,
      name: prompt.owner.name,
      avatarUrl: prompt.owner.avatarUrl,
    },
    viewCount: viewCountByPrompt.get(prompt.id) ?? 0,
    favorited: favoritedPromptIds.has(prompt.id),
    myRating: myRatingByPrompt.get(prompt.id) ?? null,
    isSmartPick: "isSmartPick" in prompt ? prompt.isSmartPick : false,
  }));

  const weekTopKeys = await getWeekTopAssetKeySet(auth.teamId);
  const dataWithWeek = data.map((row) => ({
    ...row,
    isTopAssetThisWeek: weekTopKeys.has(weekTopAssetKey("prompt", row.id)),
  }));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return res.status(200).json({
    data: dataWithWeek,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
      snapshot: {
        promptsPublished,
        activeUsers,
        promptsUsed,
      },
    },
  });
});

promptsRouter.post("/", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedBody = createPromptBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }
  const { title, summary, body, visibility, status, modelHint, tools, modality, variables, tagIds } = parsedBody.data;

  const duplicateCheck = await checkPromptDuplicates(title, body);
  if (duplicateCheck.hasDuplicate) {
    return res.status(409).json(formatDuplicateError(duplicateCheck));
  }

  const prompt = await prisma.prompt.create({
    data: {
      teamId: auth.teamId,
      ownerId: auth.userId,
      title: title.trim(),
      titleNormalized: normalizeTitle(title),
      summary: summary?.trim() || null,
      body,
      bodyHash: computeBodyHash(body),
      visibility: visibility ?? "PUBLIC",
      status: status ?? "DRAFT",
      tools,
      modality: apiToDbModality[modality],
      modelHint: modelHint?.trim() || null,
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
          createdById: auth.userId,
          changelog: "Initial version",
        },
      },
    },
    include: { variables: true },
  });

  const uniquePromptTagIds = [...new Set(tagIds)];
  const tagsOk = await validateTagIdsExist(uniquePromptTagIds);
  if (!tagsOk) {
    await prisma.prompt.delete({ where: { id: prompt.id } });
    return res.status(400).json({
      error: { code: "BAD_REQUEST", message: "One or more tags are invalid." },
    });
  }
  await prisma.promptTag.createMany({
    data: uniquePromptTagIds.map((tagId) => ({ promptId: prompt.id, tagId })),
  });

  void queuePromptThumbnailGeneration(prompt.id);

  if (status === "PUBLISHED") {
    scheduleSystemCollectionRefresh(auth.teamId, tools);
  }

  const created = await prisma.prompt.findUnique({
    where: { id: prompt.id },
    include: { variables: true, promptTags: { include: { tag: true } } },
  });
  if (!created) {
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Prompt creation failed." } });
  }

  notifySlackIfEnteredPublicPublished({
    before: null,
    after: {
      id: created.id,
      title: created.title,
      summary: created.summary,
      visibility: created.visibility,
      status: created.status,
      tools: created.tools,
      modality: created.modality,
    },
    tagNames: (created.promptTags ?? []).map((item: { tag: { name: string } }) => item.tag.name),
    assetKind: "prompt",
    ownerId: created.ownerId,
  });

  return res.status(201).json({
    data: {
      ...serializePromptWithModality(created),
      thumbnailStatus: created.thumbnailStatus as ThumbnailStatusValue,
      tags: (created.promptTags ?? []).map((item: { tag: { name: string } }) => item.tag.name),
    },
  });
});

promptsRouter.put("/:id/variables", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = replacePromptVariablesBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const promptId = parsedParams.data.id;
  const existing = await prisma.prompt.findUnique({ where: { id: promptId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }

  if (!canMutateTeamScopedAsset(existing, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can modify this prompt." } });
  }

  const rows = parsedBody.data.variables.map((item) => ({
    promptId,
    key: item.key.trim(),
    label: item.label?.trim() || null,
    defaultValue: typeof item.defaultValue === "string" ? item.defaultValue : null,
    required: item.required ?? false,
  }));

  const transactionSteps = [prisma.promptVariable.deleteMany({ where: { promptId } })];
  if (rows.length > 0) {
    transactionSteps.push(prisma.promptVariable.createMany({ data: rows }));
  }
  await prisma.$transaction(transactionSteps);

  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true, ou: true } },
      promptTags: { include: { tag: true } },
      variables: true,
      ratings: true,
      _count: { select: { favorites: true, usageEvents: true } },
    },
  });

  if (!prompt) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  if (!canAccessPromptByVisibility(prompt, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this prompt." } });
  }

  return res.status(200).json({
    data: {
      ...serializePromptWithModality(prompt),
      thumbnailStatus: prompt.thumbnailStatus as ThumbnailStatusValue,
    },
  });
});

promptsRouter.get("/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const promptId = parsedParams.data.id;
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true, ou: true } },
      promptTags: { include: { tag: true } },
      variables: true,
      ratings: true,
      _count: { select: { favorites: true, usageEvents: true } },
    },
  });

  if (!prompt) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  if (!canAccessPromptByVisibility(prompt, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this prompt." } });
  }
  if (!canViewAssetInTeamCatalog(prompt.status, prompt.ownerId, auth.userId)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }

  const [viewCount, favoriteRow, ratingRow, weekTopKeys] = await Promise.all([
    prisma.usageEvent.count({ where: { promptId, action: UsageAction.VIEW } }),
    prisma.favorite.findUnique({ where: { userId_promptId: { userId: auth.userId, promptId } } }),
    prisma.rating.findUnique({ where: { userId_promptId: { userId: auth.userId, promptId } } }),
    getWeekTopAssetKeySet(prompt.teamId),
  ]);

  return res.status(200).json({
    data: {
      ...serializePromptWithModality(prompt),
      thumbnailStatus: prompt.thumbnailStatus as ThumbnailStatusValue,
      tags: (prompt.promptTags ?? []).map((item: { tag: { name: string } }) => item.tag.name),
      viewCount,
      favorited: Boolean(favoriteRow),
      myRating: ratingRow?.value ?? null,
      isTopAssetThisWeek: weekTopKeys.has(weekTopAssetKey("prompt", prompt.id)),
    },
  });
});

promptsRouter.patch("/:id", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = updatePromptBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const promptId = parsedParams.data.id;
  const updateData = parsedBody.data;
  const existing = await prisma.prompt.findUnique({ where: { id: promptId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }

  if (!canMutateTeamScopedAsset(existing, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can modify this prompt." } });
  }

  if (updateData.tagIds !== undefined && auth.userId !== existing.ownerId) {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Only the asset owner can change tags." },
    });
  }

  const nextSummary =
    typeof updateData.summary === "string" ? updateData.summary.trim() : undefined;
  const summaryCheck = checkUpdatedSummaryLength(nextSummary, existing.summary);
  if (!summaryCheck.ok) {
    return res.status(400).json({
      error: { code: "BAD_REQUEST", message: summaryCheck.message },
    });
  }

  const nextTitle = typeof updateData.title === "string" ? updateData.title.trim() : existing.title;
  const nextBody = typeof updateData.body === "string" ? updateData.body : existing.body;

  const titleChanged = nextTitle !== existing.title;
  const bodyChanged = nextBody !== existing.body;
  if (titleChanged || bodyChanged) {
    const duplicateCheck = await checkPromptDuplicates(nextTitle, nextBody, promptId);
    if (duplicateCheck.hasDuplicate) {
      return res.status(409).json(formatDuplicateError(duplicateCheck));
    }
  }

  let modelHint: string | null | undefined;
  if (updateData.modelHint !== undefined) {
    if (updateData.modelHint === null) {
      modelHint = null;
    } else {
      const trimmed = updateData.modelHint.trim();
      modelHint = trimmed.length === 0 ? null : trimmed;
    }
  }

  let updated = await prisma.prompt.update({
    where: { id: promptId },
    data: {
      title: typeof updateData.title === "string" ? updateData.title.trim() : undefined,
      titleNormalized: titleChanged ? normalizeTitle(nextTitle) : undefined,
      summary: typeof updateData.summary === "string" ? updateData.summary.trim() : undefined,
      body: nextBody,
      bodyHash: bodyChanged ? computeBodyHash(nextBody) : undefined,
      visibility: updateData.visibility,
      status: updateData.status,
      tools: Array.isArray(updateData.tools) ? updateData.tools : undefined,
      modality: typeof updateData.modality === "string" ? apiToDbModality[updateData.modality] : undefined,
      ...(updateData.modelHint !== undefined ? { modelHint } : {}),
    },
    include: {
      variables: true,
      promptTags: { include: { tag: true } },
      ratings: true,
      _count: { select: { favorites: true, usageEvents: true } },
    },
  });

  if (nextBody !== existing.body) {
    const latest = await prisma.promptVersion.findFirst({
      where: { promptId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    await prisma.promptVersion.create({
      data: {
        promptId,
        version: (latest?.version ?? 0) + 1,
        body: nextBody,
        createdById: auth.userId,
        changelog: typeof updateData.changelog === "string" ? updateData.changelog : null,
      },
    });
  }

  if (updateData.tagIds !== undefined) {
    const uniqueTagIds = [...new Set(updateData.tagIds)];
    if (uniqueTagIds.length > 0) {
      const foundTags = await prisma.tag.findMany({
        where: { id: { in: uniqueTagIds } },
        select: { id: true },
      });
      if (foundTags.length !== uniqueTagIds.length) {
        return res.status(400).json({
          error: { code: "BAD_REQUEST", message: "One or more tags are invalid." },
        });
      }
    }
    const tagSteps: Prisma.PrismaPromise<unknown>[] = [prisma.promptTag.deleteMany({ where: { promptId } })];
    if (uniqueTagIds.length > 0) {
      tagSteps.push(
        prisma.promptTag.createMany({
          data: uniqueTagIds.map((tagId) => ({ promptId, tagId })),
        }),
      );
    }
    await prisma.$transaction(tagSteps);
    const refreshed = await prisma.prompt.findUnique({
      where: { id: promptId },
      include: {
        variables: true,
        promptTags: { include: { tag: true } },
        ratings: true,
        _count: { select: { favorites: true, usageEvents: true } },
      },
    });
    if (refreshed) {
      updated = refreshed;
    }
  }

  const toolsChanged =
    Array.isArray(updateData.tools) &&
    (updateData.tools.length !== existing.tools.length ||
      updateData.tools.some((t) => !existing.tools.includes(t)));
  const statusChanged = updateData.status !== undefined && updateData.status !== existing.status;
  const isNowPublished = updated.status === "PUBLISHED";

  if ((toolsChanged || statusChanged) && isNowPublished) {
    const allTools = new Set([...existing.tools, ...updated.tools]);
    scheduleSystemCollectionRefresh(updated.teamId, Array.from(allTools));
  }

  notifySlackIfEnteredPublicPublished({
    before: { visibility: existing.visibility, status: existing.status },
    after: {
      id: updated.id,
      title: updated.title,
      summary: updated.summary,
      visibility: updated.visibility,
      status: updated.status,
      tools: updated.tools,
      modality: updated.modality,
    },
    tagNames: (updated.promptTags ?? []).map((item: { tag: { name: string } }) => item.tag.name),
    assetKind: "prompt",
    ownerId: updated.ownerId,
  });

  return res.status(200).json({
    data: {
      ...serializePromptWithModality(updated),
      thumbnailStatus: updated.thumbnailStatus as ThumbnailStatusValue,
      tags: (updated.promptTags ?? []).map((item: { tag: { name: string } }) => item.tag.name),
    },
  });
});

promptsRouter.post("/:id/regenerate-thumbnail", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const promptId = parsedParams.data.id;
  const existing = await prisma.prompt.findUnique({ where: { id: promptId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }

  if (!canMutateTeamScopedAsset(existing, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can modify this prompt." } });
  }

  const queued = await prisma.prompt.update({
    where: { id: promptId },
    data: {
      thumbnailStatus: "PENDING",
      thumbnailError: null,
    },
  });

  void queuePromptThumbnailGeneration(promptId);

  return res.status(202).json({
    data: {
      ...serializePromptWithModality(queued),
      thumbnailStatus: queued.thumbnailStatus as ThumbnailStatusValue,
    },
  });
});

promptsRouter.delete("/:id", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const promptId = parsedParams.data.id;
  const existing = await prisma.prompt.findUnique({ where: { id: promptId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }

  if (!canMutateTeamScopedAsset(existing, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can archive this prompt." } });
  }

  await prisma.prompt.update({
    where: { id: promptId },
    data: { status: "ARCHIVED" },
  });
  await logManualArchive("PROMPT", promptId, auth.userId);
  const archived = await prisma.prompt.findUnique({ where: { id: promptId } });

  if (existing.status === "PUBLISHED") {
    scheduleSystemCollectionRefresh(existing.teamId, existing.tools);
  }

  return res.status(200).json({ data: archived });
});

promptsRouter.post("/:id/verify", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const promptId = parsedParams.data.id;
  const existing = await prisma.prompt.findUnique({ where: { id: promptId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  if (!isOwnerOrWorkspaceAdmin(existing.ownerId, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can verify this prompt." } });
  }
  await verifyAsset("PROMPT", promptId, auth.userId);
  const updated = await prisma.prompt.findUnique({ where: { id: promptId } });
  return res.status(200).json({ data: updated });
});

promptsRouter.post("/:id/unarchive", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const promptId = parsedParams.data.id;
  const existing = await prisma.prompt.findUnique({ where: { id: promptId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  if (!isOwnerOrWorkspaceAdmin(existing.ownerId, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can unarchive this prompt." } });
  }
  await unarchiveAsset("PROMPT", promptId, auth.userId);
  const updated = await prisma.prompt.findUnique({ where: { id: promptId } });
  if (updated?.status === "PUBLISHED") {
    scheduleSystemCollectionRefresh(existing.teamId, existing.tools);
  }
  return res.status(200).json({ data: updated });
});

promptsRouter.post("/:id/transfer-owner", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  if (auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only admins can transfer ownership." } });
  }
  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = transferOwnerBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }
  const promptId = parsedParams.data.id;
  const { newOwnerId, reason } = parsedBody.data;
  const existing = await prisma.prompt.findUnique({ where: { id: promptId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  const newOwner = await prisma.user.findUnique({ where: { id: newOwnerId }, select: { id: true, teamId: true } });
  if (!newOwner || newOwner.teamId !== existing.teamId) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "New owner must be a user on the same team." } });
  }
  await transferOwner("PROMPT", promptId, auth.userId, newOwnerId, reason);
  const updated = await prisma.prompt.findUnique({ where: { id: promptId } });
  return res.status(200).json({ data: updated });
});

promptsRouter.delete("/:id/permanent", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const promptId = parsedParams.data.id;
  const existing = await prisma.prompt.findUnique({ where: { id: promptId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }

  if (!isOwnerOrWorkspaceAdmin(existing.ownerId, auth)) {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Only the owner can permanently delete this prompt." },
    });
  }

  await prisma.$transaction([
    prisma.usageEvent.deleteMany({ where: { promptId } }),
    prisma.rating.deleteMany({ where: { promptId } }),
    prisma.favorite.deleteMany({ where: { promptId } }),
    prisma.promptTag.deleteMany({ where: { promptId } }),
    prisma.promptVariable.deleteMany({ where: { promptId } }),
    prisma.promptVersion.deleteMany({ where: { promptId } }),
    prisma.collectionPrompt.deleteMany({ where: { promptId } }),
    prisma.prompt.delete({ where: { id: promptId } }),
  ]);

  if (existing.status === "PUBLISHED") {
    scheduleSystemCollectionRefresh(existing.teamId, existing.tools);
  }

  return res.status(200).json({ data: { deleted: true, id: promptId } });
});

promptsRouter.get("/:id/versions", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const promptId = parsedParams.data.id;
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: {
      id: true,
      teamId: true,
      ownerId: true,
      status: true,
      visibility: true,
      owner: { select: { ou: true } },
    },
  });
  if (!prompt) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  if (!canAccessPromptByVisibility(prompt, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this prompt." } });
  }
  if (!canViewAssetInTeamCatalog(prompt.status, prompt.ownerId, auth.userId)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  const versions = await prisma.promptVersion.findMany({
    where: { promptId },
    orderBy: { version: "desc" },
  });
  return res.status(200).json({ data: versions });
});

promptsRouter.post("/:id/versions", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = createPromptVersionBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const promptId = parsedParams.data.id;
  const existing = await prisma.prompt.findUnique({ where: { id: promptId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  if (!canMutateTeamScopedAsset(existing, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can version this prompt." } });
  }

  const latestVersion = await prisma.promptVersion.findFirst({
    where: { promptId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latestVersion?.version ?? 0) + 1;
  const nextBody = parsedBody.data.body;

  const updatedPrompt = await prisma.prompt.update({
    where: { id: promptId },
    data: { body: nextBody },
  });
  const createdVersion = await prisma.promptVersion.create({
    data: {
      promptId,
      version: nextVersion,
      body: nextBody,
      createdById: auth.userId,
      changelog: typeof parsedBody.data.changelog === "string" ? parsedBody.data.changelog : null,
    },
  });

  return res.status(201).json({
    data: {
      ...serializePromptWithModality(updatedPrompt),
      thumbnailStatus: updatedPrompt.thumbnailStatus as ThumbnailStatusValue,
      latestVersion: createdVersion.version,
    },
  });
});

promptsRouter.post("/:id/restore/:version", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedParams = promptRestoreParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const promptId = parsedParams.data.id;
  const targetVersion = parsedParams.data.version;
  const prompt = await prisma.prompt.findUnique({ where: { id: promptId } });
  if (!prompt) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }

  if (!canMutateTeamScopedAsset(prompt, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can restore this prompt." } });
  }

  const version = await prisma.promptVersion.findFirst({ where: { promptId, version: targetVersion } });
  if (!version) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt version not found." } });
  }
  const updated = await prisma.prompt.update({
    where: { id: promptId },
    data: { body: version.body },
  });
  return res.status(200).json({ data: updated });
});

promptsRouter.post("/:id/favorite", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const promptId = parsedParams.data.id;
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: {
      id: true,
      teamId: true,
      ownerId: true,
      status: true,
      visibility: true,
      owner: { select: { ou: true } },
    },
  });
  if (!prompt) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  if (!canAccessPromptByVisibility(prompt, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this prompt." } });
  }
  if (!canViewAssetInTeamCatalog(prompt.status, prompt.ownerId, auth.userId)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }

  const existing = await prisma.favorite.findUnique({ where: { userId_promptId: { userId: auth.userId, promptId } } });
  if (existing) {
    await prisma.favorite.delete({ where: { userId_promptId: { userId: auth.userId, promptId } } });
    return res.status(200).json({ data: { favorited: false } });
  }
  await prisma.favorite.create({ data: { userId: auth.userId, promptId } });
  return res.status(200).json({ data: { favorited: true } });
});

promptsRouter.post("/:id/rating", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = ratingBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }
  const promptId = parsedParams.data.id;
  const { value, feedbackFlags, comment } = parsedBody.data;
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: {
      id: true,
      teamId: true,
      ownerId: true,
      status: true,
      visibility: true,
      owner: { select: { ou: true } },
    },
  });
  if (!prompt) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  if (!canAccessPromptByVisibility(prompt, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this prompt." } });
  }
  if (!canViewAssetInTeamCatalog(prompt.status, prompt.ownerId, auth.userId)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  if (prompt.ownerId === auth.userId) {
    return res
      .status(403)
      .json({ error: { code: "FORBIDDEN", message: "You can't rate your own prompt." } });
  }
  const flags = feedbackFlags ?? [];
  const rating = await prisma.rating.upsert({
    where: { userId_promptId: { userId: auth.userId, promptId } },
    create: { userId: auth.userId, promptId, value, feedbackFlags: flags, comment: comment ?? null },
    update: { value, feedbackFlags: flags, comment: comment ?? null },
  });
  return res.status(200).json({ data: rating });
});

promptsRouter.post("/:id/usage", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedParams = promptIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = usageBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }
  const promptId = parsedParams.data.id;
  const action = parsedBody.data.action;
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: {
      id: true,
      teamId: true,
      ownerId: true,
      status: true,
      visibility: true,
      owner: { select: { ou: true } },
    },
  });
  if (!prompt) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  if (!canAccessPromptByVisibility(prompt, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this prompt." } });
  }
  if (!canViewAssetInTeamCatalog(prompt.status, prompt.ownerId, auth.userId)) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Prompt not found." } });
  }
  if (action === UsageAction.COPY || action === UsageAction.LAUNCH) {
    await prisma.$transaction([
      prisma.usageEvent.create({ data: { promptId, userId: auth.userId, action } }),
      prisma.prompt.update({ where: { id: promptId }, data: { usageCount: { increment: 1 } } }),
    ]);
  } else {
    await prisma.usageEvent.create({ data: { promptId, userId: auth.userId, action } });
  }
  return res.status(200).json({ data: { ok: true } });
});

export { promptsRouter };
