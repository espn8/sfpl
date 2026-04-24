import { performance } from "node:perf_hooks";
import { Prisma, PromptModality, UsageAction } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { getAuthContext, requireAuth, requireOnboardingComplete } from "../middleware/auth";
import { ownerNameSearchClause } from "../lib/assetSearch";
import { prisma } from "../lib/prisma";
import { timeSection, recordTiming } from "../middleware/requestTiming";
import { buildVisibilityWhereFragment } from "../lib/visibility";
import { thumbnailRefFor } from "./thumbnails";
import { getWeekTopAssetKeySet, weekTopAssetKey } from "../services/weekTopAssets";

const assetsRouter = Router();

const ASSET_TOOLS = ["agentforce_vibes", "chatgpt", "claude_code", "claude_cowork", "cursor", "gemini", "meshmesh", "notebooklm", "other", "saleo", "slackbot"] as const;
const assetToolSchema = z.enum(ASSET_TOOLS);

const API_MODALITIES = ["text", "code", "image", "video", "audio", "multimodal"] as const;
type ApiModality = (typeof API_MODALITIES)[number];

function mapDbModalityToApi(value: PromptModality): ApiModality {
  switch (value) {
    case PromptModality.CODE:
      return "code";
    case PromptModality.IMAGE:
      return "image";
    case PromptModality.VIDEO:
      return "video";
    case PromptModality.AUDIO:
      return "audio";
    case PromptModality.MULTIMODAL:
      return "multimodal";
    case PromptModality.TEXT:
    default:
      return "text";
  }
}

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

function badRequestFromZodError(error: z.ZodError) {
  return {
    error: {
      code: "BAD_REQUEST",
      message: "Invalid request.",
      details: error.issues,
    },
  };
}

const listAssetsQuerySchema = z.object({
  q: z.string().trim().optional(),
  assetType: z.enum(["all", "prompt", "skill", "context", "build"]).optional(),
  tool: assetToolSchema.optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  sort: z.enum(["recent", "mostUsed", "name", "updatedAt", "topRated"]).optional(),
  mine: z.coerce.boolean().optional(),
  includeAnalytics: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  // NOTE: z.coerce.boolean() uses JS truthy semantics, which means the
  // string "false" coerces to true (any non-empty string is truthy). The
  // snapshot flag is meaningful only as an explicit opt-out ("false"), so
  // parse it ourselves and keep the semantics unambiguous.
  snapshot: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => (typeof v === "boolean" ? v : v === "true"))
    .optional(),
});

type AssetType = "prompt" | "skill" | "context" | "build";

type UnifiedAsset = {
  id: number;
  assetType: AssetType;
  title: string;
  summary: string | null;
  body?: string;
  skillUrl?: string;
  supportUrl?: string | null;
  status: string;
  visibility: string;
  tools: string[];
  createdAt: Date;
  updatedAt: Date;
  owner: { id: number; name: string | null; avatarUrl: string | null };
  viewCount: number;
  usageCount: number;
  favorited: boolean;
  favoriteCount: number;
  ratingCount?: number;
  modality?: ApiModality;
  modelHint?: string | null;
  thumbnailUrl?: string | null;
  thumbnailStatus?: string;
  averageRating?: number | null;
  myRating?: number | null;
  variables?: Array<{ key: string; label: string | null; defaultValue: string | null; required: boolean }>;
  isSmartPick?: boolean;
  isTopAssetThisWeek?: boolean;
};

assetsRouter.use(requireAuth);
assetsRouter.use(requireOnboardingComplete);

assetsRouter.get("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedQuery = listAssetsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json(badRequestFromZodError(parsedQuery.error));
  }

  const q = parsedQuery.data.q ?? "";
  const assetType = parsedQuery.data.assetType ?? "all";
  const tool = parsedQuery.data.tool;
  const status = parsedQuery.data.status;
  const sort = parsedQuery.data.sort ?? "recent";
  const mine = parsedQuery.data.mine ?? false;
  const includeAnalytics = parsedQuery.data.includeAnalytics ?? false;
  const page = parsedQuery.data.page ?? 1;
  const pageSize = parsedQuery.data.pageSize ?? 20;
  // snapshot defaults to true so existing callers keep getting meta.snapshot;
  // HomePage's secondary (top-performers) call opts out with snapshot=false to
  // skip 6 team-wide count queries that don't vary between requests.
  const includeSnapshot = parsedQuery.data.snapshot ?? true;

  const includePrompts = assetType === "all" || assetType === "prompt";
  const includeSkills = assetType === "all" || assetType === "skill";
  const includeContext = assetType === "all" || assetType === "context";
  const includeBuilds = assetType === "all" || assetType === "build";

  const typeTotals = { prompt: 0, skill: 0, context: 0, build: 0 };

  const buildPromptVisibilityWhere = (): Prisma.PromptWhereInput => {
    const where: Prisma.PromptWhereInput = {};
    if (mine) {
      where.ownerId = auth.userId;
      where.teamId = auth.teamId;
    } else {
      const fragment = buildVisibilityWhereFragment(auth) as Prisma.PromptWhereInput;
      if (fragment.OR) {
        where.AND = [fragment];
      }
    }
    return where;
  };

  const addPromptSearchConditions = (where: Prisma.PromptWhereInput) => {
    if (q) {
      const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
      where.AND = [
        ...existingAnd,
        {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
            ownerNameSearchClause(q),
          ],
        },
      ];
    }
    return where;
  };

  const allAssets: UnifiedAsset[] = [];

  if (includePrompts) {
    let promptWhere: Prisma.PromptWhereInput = buildPromptVisibilityWhere();
    promptWhere = addPromptSearchConditions(promptWhere);
    if (tool) {
      promptWhere.tools = { has: tool };
    }
    if (status) {
      promptWhere.status = status;
    }

    const promptOrderBy: Prisma.PromptOrderByWithRelationInput =
      sort === "mostUsed"
        ? { usageCount: "desc" as const }
        : sort === "name"
        ? { title: "asc" as const }
        : sort === "updatedAt"
        ? { updatedAt: "desc" as const }
        : { createdAt: "desc" as const };

    const prompts = await timeSection("prompts.findMany", () =>
      prisma.prompt.findMany({
        where: promptWhere,
        select: {
          id: true,
          title: true,
          summary: true,
          status: true,
          visibility: true,
          modelHint: true,
          tools: true,
          modality: true,
          thumbnailStatus: true,
          isSmartPick: true,
          usageCount: true,
          createdAt: true,
          updatedAt: true,
          owner: { select: { id: true, name: true, avatarUrl: true } },
          variables: { select: { key: true, label: true, defaultValue: true, required: true } },
          ratings: { select: { value: true } },
        },
        orderBy: promptOrderBy,
        take: pageSize * 3,
      }),
    );
    typeTotals.prompt = await timeSection("prompts.count", () => prisma.prompt.count({ where: promptWhere }));

    const promptIds = prompts.map((p) => p.id);
    let viewCountByPrompt = new Map<number, number>();
    let favoritedPromptIds = new Set<number>();
    let favoriteCountByPrompt = new Map<number, number>();
    let myRatingByPrompt = new Map<number, number>();

    if (promptIds.length > 0) {
      const [viewGroups, favoriteRows, favoriteCountGroups, ratingRows] = await timeSection(
        "prompts.agg",
        () =>
          Promise.all([
            prisma.usageEvent.groupBy({
              by: ["promptId"],
              where: { promptId: { in: promptIds }, action: UsageAction.VIEW },
              _count: { _all: true },
            }),
            prisma.favorite.findMany({
              where: { userId: auth.userId, promptId: { in: promptIds } },
              select: { promptId: true },
            }),
            prisma.favorite.groupBy({
              by: ["promptId"],
              where: { promptId: { in: promptIds } },
              _count: { _all: true },
            }),
            prisma.rating.findMany({
              where: { userId: auth.userId, promptId: { in: promptIds } },
              select: { promptId: true, value: true },
            }),
          ]),
      );
      viewCountByPrompt = new Map(viewGroups.map((g) => [g.promptId, g._count._all]));
      favoritedPromptIds = new Set(favoriteRows.map((r) => r.promptId));
      favoriteCountByPrompt = new Map(favoriteCountGroups.map((g) => [g.promptId, g._count._all]));
      myRatingByPrompt = new Map(ratingRows.map((r) => [r.promptId, r.value]));
    }

    for (const prompt of prompts) {
      const tools = prompt.tools.length > 0 ? prompt.tools : mapLegacyModelHintToTools(prompt.modelHint);
      allAssets.push({
        id: prompt.id,
        assetType: "prompt",
        title: prompt.title,
        summary: prompt.summary,
        status: prompt.status,
        visibility: prompt.visibility,
        tools,
        createdAt: prompt.createdAt,
        updatedAt: prompt.updatedAt,
        owner: prompt.owner,
        viewCount: viewCountByPrompt.get(prompt.id) ?? 0,
        usageCount: prompt.usageCount,
        favorited: favoritedPromptIds.has(prompt.id),
        favoriteCount: favoriteCountByPrompt.get(prompt.id) ?? 0,
        ratingCount: prompt.ratings.length,
        modality: mapDbModalityToApi(prompt.modality),
        modelHint: prompt.modelHint,
        thumbnailUrl: thumbnailRefFor("prompt", prompt.id, prompt.thumbnailStatus, prompt.updatedAt),
        thumbnailStatus: prompt.thumbnailStatus,
        averageRating:
          prompt.ratings.length === 0
            ? null
            : prompt.ratings.reduce((sum, r) => sum + r.value, 0) / prompt.ratings.length,
        myRating: myRatingByPrompt.get(prompt.id) ?? null,
        variables: prompt.variables,
        isSmartPick: prompt.isSmartPick,
      });
    }
  }

  if (includeSkills) {
    const skillWhere: Prisma.SkillWhereInput = {};
    const skillAnd: Prisma.SkillWhereInput[] = [];
    if (mine) {
      skillWhere.ownerId = auth.userId;
      skillWhere.teamId = auth.teamId;
    } else {
      skillAnd.push(buildVisibilityWhereFragment(auth) as Prisma.SkillWhereInput);
    }
    if (q) {
      skillAnd.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
          ownerNameSearchClause(q),
        ],
      });
    }
    if (tool) {
      skillWhere.tools = { has: tool };
    }
    if (status) {
      skillWhere.status = status;
    }
    if (skillAnd.length > 0) {
      skillWhere.AND = skillAnd;
    }

    const skillOrderBy: Prisma.SkillOrderByWithRelationInput =
      sort === "mostUsed"
        ? { usageCount: "desc" as const }
        : sort === "name"
        ? { title: "asc" as const }
        : sort === "updatedAt"
        ? { updatedAt: "desc" as const }
        : { createdAt: "desc" as const };

    const skills = await timeSection("skills.findMany", () =>
      prisma.skill.findMany({
        where: skillWhere,
        select: {
          id: true,
          title: true,
          summary: true,
          skillUrl: true,
          supportUrl: true,
          status: true,
          visibility: true,
          tools: true,
          thumbnailStatus: true,
          isSmartPick: true,
          usageCount: true,
          createdAt: true,
          updatedAt: true,
          owner: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: skillOrderBy,
        take: pageSize * 3,
      }),
    );
    typeTotals.skill = await timeSection("skills.count", () => prisma.skill.count({ where: skillWhere }));

    const skillIds = skills.map((s) => s.id);
    let viewCountBySkill = new Map<number, number>();
    let favoritedSkillIds = new Set<number>();
    let favoriteCountBySkill = new Map<number, number>();
    let myRatingBySkill = new Map<number, number>();
    let ratingDataBySkill = new Map<number, { count: number; avg: number | null }>();

    if (skillIds.length > 0) {
      const [viewGroups, favoriteRows, favoriteCountGroups, ratingRows, ratingGroups] = await timeSection(
        "skills.agg",
        () =>
          Promise.all([
            prisma.skillUsageEvent.groupBy({
              by: ["skillId"],
              where: { skillId: { in: skillIds }, eventType: "VIEW" },
              _count: { skillId: true },
            }),
            prisma.skillFavorite.findMany({
              where: { userId: auth.userId, skillId: { in: skillIds } },
              select: { skillId: true },
            }),
            prisma.skillFavorite.groupBy({
              by: ["skillId"],
              where: { skillId: { in: skillIds } },
              _count: { _all: true },
            }),
            prisma.skillRating.findMany({
              where: { userId: auth.userId, skillId: { in: skillIds } },
              select: { skillId: true, value: true },
            }),
            prisma.skillRating.groupBy({
              by: ["skillId"],
              where: { skillId: { in: skillIds } },
              _count: { skillId: true },
              _avg: { value: true },
            }),
          ]),
      );
      viewCountBySkill = new Map(viewGroups.map((g) => [g.skillId, g._count.skillId]));
      favoritedSkillIds = new Set(favoriteRows.map((r) => r.skillId));
      favoriteCountBySkill = new Map(favoriteCountGroups.map((g) => [g.skillId, g._count._all]));
      myRatingBySkill = new Map(ratingRows.map((r) => [r.skillId, r.value]));
      ratingDataBySkill = new Map(ratingGroups.map((g) => [g.skillId, { count: g._count.skillId, avg: g._avg.value }]));
    }

    for (const skill of skills) {
      const ratingInfo = ratingDataBySkill.get(skill.id);
      allAssets.push({
        id: skill.id,
        assetType: "skill",
        title: skill.title,
        summary: skill.summary,
        skillUrl: skill.skillUrl,
        supportUrl: skill.supportUrl,
        status: skill.status,
        visibility: skill.visibility,
        tools: skill.tools,
        thumbnailUrl: thumbnailRefFor("skill", skill.id, skill.thumbnailStatus, skill.updatedAt),
        thumbnailStatus: skill.thumbnailStatus,
        createdAt: skill.createdAt,
        updatedAt: skill.updatedAt,
        owner: skill.owner,
        viewCount: viewCountBySkill.get(skill.id) ?? 0,
        usageCount: skill.usageCount,
        favorited: favoritedSkillIds.has(skill.id),
        favoriteCount: favoriteCountBySkill.get(skill.id) ?? 0,
        ratingCount: ratingInfo?.count ?? 0,
        averageRating: ratingInfo?.avg ?? null,
        myRating: myRatingBySkill.get(skill.id) ?? null,
        isSmartPick: skill.isSmartPick,
      });
    }
  }

  if (includeContext) {
    const contextWhere: Prisma.ContextDocumentWhereInput = {};
    const contextAnd: Prisma.ContextDocumentWhereInput[] = [];
    if (mine) {
      contextWhere.ownerId = auth.userId;
      contextWhere.teamId = auth.teamId;
    } else {
      contextAnd.push(buildVisibilityWhereFragment(auth) as Prisma.ContextDocumentWhereInput);
    }
    if (q) {
      contextAnd.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
          { body: { contains: q, mode: "insensitive" } },
          ownerNameSearchClause(q),
        ],
      });
    }
    if (tool) {
      contextWhere.tools = { has: tool };
    }
    if (status) {
      contextWhere.status = status;
    }
    if (contextAnd.length > 0) {
      contextWhere.AND = contextAnd;
    }

    const contextOrderBy: Prisma.ContextDocumentOrderByWithRelationInput =
      sort === "mostUsed"
        ? { usageCount: "desc" as const }
        : sort === "name"
        ? { title: "asc" as const }
        : sort === "updatedAt"
        ? { updatedAt: "desc" as const }
        : { createdAt: "desc" as const };

    const contextDocs = await timeSection("context.findMany", () =>
      prisma.contextDocument.findMany({
        where: contextWhere,
        select: {
          id: true,
          title: true,
          summary: true,
          status: true,
          visibility: true,
          tools: true,
          thumbnailStatus: true,
          isSmartPick: true,
          usageCount: true,
          createdAt: true,
          updatedAt: true,
          owner: { select: { id: true, name: true, avatarUrl: true } },
          variables: { select: { key: true, label: true, defaultValue: true, required: true } },
        },
        orderBy: contextOrderBy,
        take: pageSize * 3,
      }),
    );
    typeTotals.context = await timeSection("context.count", () => prisma.contextDocument.count({ where: contextWhere }));

    const contextIds = contextDocs.map((c) => c.id);
    let viewCountByContext = new Map<number, number>();
    let favoritedContextIds = new Set<number>();
    let favoriteCountByContext = new Map<number, number>();
    let myRatingByContext = new Map<number, number>();
    let ratingDataByContext = new Map<number, { count: number; avg: number | null }>();

    if (contextIds.length > 0) {
      const [viewGroups, favoriteRows, favoriteCountGroups, ratingRows, ratingGroups] = await timeSection(
        "context.agg",
        () =>
          Promise.all([
            prisma.contextUsageEvent.groupBy({
              by: ["contextId"],
              where: { contextId: { in: contextIds }, eventType: "VIEW" },
              _count: { contextId: true },
            }),
            prisma.contextFavorite.findMany({
              where: { userId: auth.userId, contextId: { in: contextIds } },
              select: { contextId: true },
            }),
            prisma.contextFavorite.groupBy({
              by: ["contextId"],
              where: { contextId: { in: contextIds } },
              _count: { _all: true },
            }),
            prisma.contextRating.findMany({
              where: { userId: auth.userId, contextId: { in: contextIds } },
              select: { contextId: true, value: true },
            }),
            prisma.contextRating.groupBy({
              by: ["contextId"],
              where: { contextId: { in: contextIds } },
              _count: { contextId: true },
              _avg: { value: true },
            }),
          ]),
      );
      viewCountByContext = new Map(viewGroups.map((g) => [g.contextId, g._count.contextId]));
      favoritedContextIds = new Set(favoriteRows.map((r) => r.contextId));
      favoriteCountByContext = new Map(favoriteCountGroups.map((g) => [g.contextId, g._count._all]));
      myRatingByContext = new Map(ratingRows.map((r) => [r.contextId, r.value]));
      ratingDataByContext = new Map(ratingGroups.map((g) => [g.contextId, { count: g._count.contextId, avg: g._avg.value }]));
    }

    for (const doc of contextDocs) {
      const ratingInfo = ratingDataByContext.get(doc.id);
      allAssets.push({
        id: doc.id,
        assetType: "context",
        title: doc.title,
        summary: doc.summary,
        status: doc.status,
        visibility: doc.visibility,
        tools: doc.tools,
        thumbnailUrl: thumbnailRefFor("context", doc.id, doc.thumbnailStatus, doc.updatedAt),
        thumbnailStatus: doc.thumbnailStatus,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        owner: doc.owner,
        viewCount: viewCountByContext.get(doc.id) ?? 0,
        usageCount: doc.usageCount,
        favorited: favoritedContextIds.has(doc.id),
        favoriteCount: favoriteCountByContext.get(doc.id) ?? 0,
        ratingCount: ratingInfo?.count ?? 0,
        averageRating: ratingInfo?.avg ?? null,
        myRating: myRatingByContext.get(doc.id) ?? null,
        variables: doc.variables,
        isSmartPick: doc.isSmartPick,
      });
    }
  }

  if (includeBuilds) {
    const buildWhere: Prisma.BuildWhereInput = {};
    const buildAnd: Prisma.BuildWhereInput[] = [];
    if (mine) {
      buildWhere.ownerId = auth.userId;
      buildWhere.teamId = auth.teamId;
    } else {
      buildAnd.push(buildVisibilityWhereFragment(auth) as Prisma.BuildWhereInput);
    }
    if (q) {
      buildAnd.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
          ownerNameSearchClause(q),
        ],
      });
    }
    if (status) {
      buildWhere.status = status;
    }
    if (buildAnd.length > 0) {
      buildWhere.AND = buildAnd;
    }

    const buildOrderBy: Prisma.BuildOrderByWithRelationInput =
      sort === "mostUsed"
        ? { usageCount: "desc" as const }
        : sort === "name"
        ? { title: "asc" as const }
        : sort === "updatedAt"
        ? { updatedAt: "desc" as const }
        : { createdAt: "desc" as const };

    const builds = await timeSection("builds.findMany", () =>
      prisma.build.findMany({
        where: buildWhere,
        select: {
          id: true,
          title: true,
          summary: true,
          buildUrl: true,
          supportUrl: true,
          status: true,
          visibility: true,
          thumbnailStatus: true,
          isSmartPick: true,
          usageCount: true,
          createdAt: true,
          updatedAt: true,
          owner: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: buildOrderBy,
        take: pageSize * 3,
      }),
    );
    typeTotals.build = await timeSection("builds.count", () => prisma.build.count({ where: buildWhere }));

    const buildIds = builds.map((b) => b.id);
    let viewCountByBuild = new Map<number, number>();
    let favoritedBuildIds = new Set<number>();
    let favoriteCountByBuild = new Map<number, number>();
    let myRatingByBuild = new Map<number, number>();
    let ratingDataByBuild = new Map<number, { count: number; avg: number | null }>();

    if (buildIds.length > 0) {
      const [viewGroups, favoriteRows, favoriteCountGroups, ratingRows, ratingGroups] = await timeSection(
        "builds.agg",
        () =>
          Promise.all([
            prisma.buildUsageEvent.groupBy({
              by: ["buildId"],
              where: { buildId: { in: buildIds }, eventType: "VIEW" },
              _count: { buildId: true },
            }),
            prisma.buildFavorite.findMany({
              where: { userId: auth.userId, buildId: { in: buildIds } },
              select: { buildId: true },
            }),
            prisma.buildFavorite.groupBy({
              by: ["buildId"],
              where: { buildId: { in: buildIds } },
              _count: { _all: true },
            }),
            prisma.buildRating.findMany({
              where: { userId: auth.userId, buildId: { in: buildIds } },
              select: { buildId: true, value: true },
            }),
            prisma.buildRating.groupBy({
              by: ["buildId"],
              where: { buildId: { in: buildIds } },
              _count: { buildId: true },
              _avg: { value: true },
            }),
          ]),
      );
      viewCountByBuild = new Map(viewGroups.map((g) => [g.buildId, g._count.buildId]));
      favoritedBuildIds = new Set(favoriteRows.map((r) => r.buildId));
      favoriteCountByBuild = new Map(favoriteCountGroups.map((g) => [g.buildId, g._count._all]));
      myRatingByBuild = new Map(ratingRows.map((r) => [r.buildId, r.value]));
      ratingDataByBuild = new Map(ratingGroups.map((g) => [g.buildId, { count: g._count.buildId, avg: g._avg.value }]));
    }

    for (const build of builds) {
      const ratingInfo = ratingDataByBuild.get(build.id);
      allAssets.push({
        id: build.id,
        assetType: "build",
        title: build.title,
        summary: build.summary,
        body: build.buildUrl,
        skillUrl: build.buildUrl,
        supportUrl: build.supportUrl,
        status: build.status,
        visibility: build.visibility,
        tools: [],
        thumbnailUrl: thumbnailRefFor("build", build.id, build.thumbnailStatus, build.updatedAt),
        thumbnailStatus: build.thumbnailStatus,
        createdAt: build.createdAt,
        updatedAt: build.updatedAt,
        owner: build.owner,
        viewCount: viewCountByBuild.get(build.id) ?? 0,
        usageCount: build.usageCount,
        favorited: favoritedBuildIds.has(build.id),
        favoriteCount: favoriteCountByBuild.get(build.id) ?? 0,
        ratingCount: ratingInfo?.count ?? 0,
        averageRating: ratingInfo?.avg ?? null,
        myRating: myRatingByBuild.get(build.id) ?? null,
        isSmartPick: build.isSmartPick,
      });
    }
  }

  const assembleStart = performance.now();
  if (sort === "mostUsed") {
    allAssets.sort((a, b) => b.usageCount - a.usageCount);
  } else if (sort === "name") {
    allAssets.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === "updatedAt") {
    allAssets.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } else if (sort === "topRated") {
    // Bayesian-smoothed top rated; we only have averageRating+ratingCount here
    // since the full rating rows were already reduced. Use a 5-prior
    // smoothing toward 3.5 (default) so noisy assets with a single 5-star
    // don't outrank mature ones. Smart Pick flag and governance filters live
    // in analytics.ts; listAssets still shows everything but reorders it.
    const PRIOR = 5;
    const GLOBAL = 3.5;
    const score = (a: { averageRating?: number | null; ratingCount?: number }) => {
      const r = a.averageRating ?? GLOBAL;
      const v = a.ratingCount ?? 0;
      return (v * r + PRIOR * GLOBAL) / (v + PRIOR);
    };
    allAssets.sort((a, b) => {
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
    });
  } else {
    allAssets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Accurate total from per-type counts (these are scoped to the same
  // visibility + search + tool + status filters as the findMany calls), not
  // from the overfetched in-memory slice. totalPages therefore reflects the
  // true dataset size, which fixes the pager UI once the team grows past the
  // overfetch window (pageSize * 3 per type).
  const total = typeTotals.prompt + typeTotals.skill + typeTotals.context + typeTotals.build;
  const skip = (page - 1) * pageSize;
  const paginatedAssets = allAssets.slice(skip, skip + pageSize);
  const weekTopKeys = await timeSection("weekTop", () => getWeekTopAssetKeySet(auth.teamId));
  const paginatedWithWeek = paginatedAssets.map((a) => ({
    ...a,
    isTopAssetThisWeek: weekTopKeys.has(weekTopAssetKey(a.assetType, a.id)),
  }));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const facets = {
    assetType: {
      prompt: typeTotals.prompt,
      skill: typeTotals.skill,
      context: typeTotals.context,
      build: typeTotals.build,
    },
    tool: {} as Record<string, number>,
  };

  for (const asset of allAssets) {
    for (const t of asset.tools) {
      facets.tool[t] = (facets.tool[t] ?? 0) + 1;
    }
  }
  recordTiming("assemble", performance.now() - assembleStart);

  type SnapshotMeta = {
    assetsPublished: number;
    promptsPublished: number;
    skillsPublished: number;
    contextPublished: number;
    buildsPublished: number;
    activeUsers: number;
    promptsUsed: number;
  };
  let snapshot: SnapshotMeta | undefined;
  if (includeSnapshot) {
    const visibilityFragment = buildVisibilityWhereFragment(auth);
    const promptSnapshotWhere: Prisma.PromptWhereInput = {
      status: "PUBLISHED",
      AND: [visibilityFragment as Prisma.PromptWhereInput],
    };
    const skillSnapshotWhere: Prisma.SkillWhereInput = {
      status: "PUBLISHED",
      AND: [visibilityFragment as Prisma.SkillWhereInput],
    };
    const contextSnapshotWhere: Prisma.ContextDocumentWhereInput = {
      status: "PUBLISHED",
      AND: [visibilityFragment as Prisma.ContextDocumentWhereInput],
    };
    const buildSnapshotWhere: Prisma.BuildWhereInput = {
      status: "PUBLISHED",
      AND: [visibilityFragment as Prisma.BuildWhereInput],
    };

    const [
      promptsPublished,
      skillsPublished,
      contextPublished,
      buildsPublished,
      activeUsers,
      promptUsageCount,
      skillUsageCount,
      contextUsageCount,
      buildUsageCount,
    ] = await timeSection("snapshot", () =>
      Promise.all([
        prisma.prompt.count({ where: promptSnapshotWhere }),
        prisma.skill.count({ where: skillSnapshotWhere }),
        prisma.contextDocument.count({ where: contextSnapshotWhere }),
        prisma.build.count({ where: buildSnapshotWhere }),
        prisma.user.count({ where: { teamId: auth.teamId } }),
        prisma.usageEvent.count({
          where: {
            prompt: { AND: [visibilityFragment as Prisma.PromptWhereInput] },
          },
        }),
        prisma.skillUsageEvent.count({
          where: {
            skill: { AND: [visibilityFragment as Prisma.SkillWhereInput] },
          },
        }),
        prisma.contextUsageEvent.count({
          where: {
            context: { AND: [visibilityFragment as Prisma.ContextDocumentWhereInput] },
          },
        }),
        prisma.buildUsageEvent.count({
          where: {
            build: { AND: [visibilityFragment as Prisma.BuildWhereInput] },
          },
        }),
      ]),
    );

    snapshot = {
      assetsPublished: promptsPublished + skillsPublished + contextPublished + buildsPublished,
      promptsPublished,
      skillsPublished,
      contextPublished,
      buildsPublished,
      activeUsers,
      promptsUsed: promptUsageCount + skillUsageCount + contextUsageCount + buildUsageCount,
    };
  }

  // Team-wide (non-mine) list responses are identical across users on the same
  // team for the same filter tuple, so browsers and intermediate caches can
  // safely reuse them for a short window. "mine" and personalized responses
  // (favorites, myRating) stay no-cache to avoid user-to-user bleed.
  if (!mine) {
    res.set("Cache-Control", "private, max-age=30, must-revalidate");
  } else {
    res.set("Cache-Control", "private, no-store");
  }

  const meta: Record<string, unknown> = {
    page,
    pageSize,
    total,
    totalPages,
    facets,
  };
  if (snapshot) {
    meta.snapshot = snapshot;
  }

  return res.status(200).json({
    data: paginatedWithWeek,
    meta,
  });
});

export { assetsRouter };
