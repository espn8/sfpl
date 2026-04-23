import { Prisma, PromptModality, UsageAction } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { getAuthContext, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const assetsRouter = Router();

const ASSET_TOOLS = ["chatgpt", "claude_code", "claude_cowork", "cursor", "gemini", "meshmesh", "notebooklm", "other", "saleo", "slackbot"] as const;
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

function isAdminOrOwner(role: string): boolean {
  return role === "ADMIN" || role === "OWNER";
}

const listAssetsQuerySchema = z.object({
  q: z.string().trim().optional(),
  assetType: z.enum(["all", "prompt", "skill", "context", "build"]).optional(),
  tool: assetToolSchema.optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  sort: z.enum(["recent", "mostUsed", "name", "updatedAt"]).optional(),
  mine: z.coerce.boolean().optional(),
  includeAnalytics: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
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
};

assetsRouter.use(requireAuth);

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

  const includePrompts = assetType === "all" || assetType === "prompt";
  const includeSkills = assetType === "all" || assetType === "skill";
  const includeContext = assetType === "all" || assetType === "context";
  const includeBuilds = assetType === "all" || assetType === "build";

  const buildVisibilityConditions = <T extends { visibility: string; ownerId: number; owner?: { ou: string | null } }>(
    baseWhere: Prisma.Args<typeof prisma.prompt, "findMany">["where"],
  ) => {
    const where = { ...baseWhere, teamId: auth.teamId } as Prisma.PromptWhereInput;
    if (mine) {
      where.ownerId = auth.userId;
    } else if (!isAdminOrOwner(auth.role)) {
      const visibilityConditions: Prisma.PromptWhereInput[] = [
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
    return where;
  };

  const buildSearchConditions = (where: Prisma.PromptWhereInput) => {
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
    return where;
  };

  const allAssets: UnifiedAsset[] = [];

  if (includePrompts) {
    let promptWhere: Prisma.PromptWhereInput = buildVisibilityConditions({});
    promptWhere = buildSearchConditions(promptWhere);
    if (tool) {
      promptWhere.tools = { has: tool };
    }
    if (status) {
      promptWhere.status = status;
    }

    const promptOrderBy: Prisma.PromptOrderByWithRelationInput =
      sort === "mostUsed"
        ? { usageEvents: { _count: "desc" as const } }
        : sort === "name"
        ? { title: "asc" as const }
        : sort === "updatedAt"
        ? { updatedAt: "desc" as const }
        : { createdAt: "desc" as const };

    const prompts = await prisma.prompt.findMany({
      where: promptWhere,
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
        thumbnailUrl: true,
        thumbnailStatus: true,
        isSmartPick: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, avatarUrl: true } },
        variables: { select: { key: true, label: true, defaultValue: true, required: true } },
        ratings: { select: { value: true } },
      },
      orderBy: promptOrderBy,
      take: pageSize * 3,
    });

    const promptIds = prompts.map((p) => p.id);
    let viewCountByPrompt = new Map<number, number>();
    let usageCountByPrompt = new Map<number, number>();
    let favoritedPromptIds = new Set<number>();
    let favoriteCountByPrompt = new Map<number, number>();
    let myRatingByPrompt = new Map<number, number>();

    if (promptIds.length > 0) {
      const [viewGroups, usageGroups, favoriteRows, favoriteCountGroups, ratingRows] = await Promise.all([
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
        prisma.favorite.groupBy({
          by: ["promptId"],
          where: { promptId: { in: promptIds } },
          _count: { _all: true },
        }),
        prisma.rating.findMany({
          where: { userId: auth.userId, promptId: { in: promptIds } },
          select: { promptId: true, value: true },
        }),
      ]);
      viewCountByPrompt = new Map(viewGroups.map((g) => [g.promptId, g._count._all]));
      usageCountByPrompt = new Map(usageGroups.map((g) => [g.promptId, g._count._all]));
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
        body: prompt.body,
        status: prompt.status,
        visibility: prompt.visibility,
        tools,
        createdAt: prompt.createdAt,
        updatedAt: prompt.updatedAt,
        owner: prompt.owner,
        viewCount: viewCountByPrompt.get(prompt.id) ?? 0,
        usageCount: usageCountByPrompt.get(prompt.id) ?? 0,
        favorited: favoritedPromptIds.has(prompt.id),
        favoriteCount: favoriteCountByPrompt.get(prompt.id) ?? 0,
        ratingCount: prompt.ratings.length,
        modality: mapDbModalityToApi(prompt.modality),
        modelHint: prompt.modelHint,
        thumbnailUrl: prompt.thumbnailUrl,
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
    let skillWhere: Prisma.SkillWhereInput = { teamId: auth.teamId };
    if (mine) {
      skillWhere.ownerId = auth.userId;
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
      skillWhere.OR = visibilityConditions;
    }
    if (q) {
      const existingAnd = Array.isArray(skillWhere.AND) ? skillWhere.AND : skillWhere.AND ? [skillWhere.AND] : [];
      skillWhere.AND = [
        ...existingAnd,
        {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
          ],
        },
      ];
    }
    if (tool) {
      skillWhere.tools = { has: tool };
    }
    if (status) {
      skillWhere.status = status;
    }

    const skillOrderBy: Prisma.SkillOrderByWithRelationInput =
      sort === "name"
        ? { title: "asc" as const }
        : sort === "updatedAt"
        ? { updatedAt: "desc" as const }
        : { createdAt: "desc" as const };

    const skills = await prisma.skill.findMany({
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
        thumbnailUrl: true,
        thumbnailStatus: true,
        isSmartPick: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: skillOrderBy,
      take: pageSize * 3,
    });

    const skillIds = skills.map((s) => s.id);
    let viewCountBySkill = new Map<number, number>();
    let copyCountBySkill = new Map<number, number>();
    let favoritedSkillIds = new Set<number>();
    let favoriteCountBySkill = new Map<number, number>();
    let myRatingBySkill = new Map<number, number>();
    let ratingDataBySkill = new Map<number, { count: number; avg: number | null }>();

    if (skillIds.length > 0) {
      const [viewGroups, copyGroups, favoriteRows, favoriteCountGroups, ratingRows, ratingGroups] = await Promise.all([
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
      ]);
      viewCountBySkill = new Map(viewGroups.map((g) => [g.skillId, g._count.skillId]));
      copyCountBySkill = new Map(copyGroups.map((g) => [g.skillId, g._count.skillId]));
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
        thumbnailUrl: skill.thumbnailUrl,
        thumbnailStatus: skill.thumbnailStatus,
        createdAt: skill.createdAt,
        updatedAt: skill.updatedAt,
        owner: skill.owner,
        viewCount: viewCountBySkill.get(skill.id) ?? 0,
        usageCount: copyCountBySkill.get(skill.id) ?? 0,
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
    let contextWhere: Prisma.ContextDocumentWhereInput = { teamId: auth.teamId };
    if (mine) {
      contextWhere.ownerId = auth.userId;
    } else if (!isAdminOrOwner(auth.role)) {
      const visibilityConditions: Prisma.ContextDocumentWhereInput[] = [
        { visibility: "PUBLIC" },
        { ownerId: auth.userId },
      ];
      if (auth.userOu) {
        visibilityConditions.push({
          visibility: "TEAM",
          owner: { ou: auth.userOu },
        });
      }
      contextWhere.OR = visibilityConditions;
    }
    if (q) {
      const existingAnd = Array.isArray(contextWhere.AND) ? contextWhere.AND : contextWhere.AND ? [contextWhere.AND] : [];
      contextWhere.AND = [
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
    if (tool) {
      contextWhere.tools = { has: tool };
    }
    if (status) {
      contextWhere.status = status;
    }

    const contextOrderBy: Prisma.ContextDocumentOrderByWithRelationInput =
      sort === "name"
        ? { title: "asc" as const }
        : sort === "updatedAt"
        ? { updatedAt: "desc" as const }
        : { createdAt: "desc" as const };

    const contextDocs = await prisma.contextDocument.findMany({
      where: contextWhere,
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
        isSmartPick: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, avatarUrl: true } },
        variables: { select: { key: true, label: true, defaultValue: true, required: true } },
      },
      orderBy: contextOrderBy,
      take: pageSize * 3,
    });

    const contextIds = contextDocs.map((c) => c.id);
    let viewCountByContext = new Map<number, number>();
    let copyCountByContext = new Map<number, number>();
    let favoritedContextIds = new Set<number>();
    let favoriteCountByContext = new Map<number, number>();
    let myRatingByContext = new Map<number, number>();
    let ratingDataByContext = new Map<number, { count: number; avg: number | null }>();

    if (contextIds.length > 0) {
      const [viewGroups, copyGroups, favoriteRows, favoriteCountGroups, ratingRows, ratingGroups] = await Promise.all([
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
      ]);
      viewCountByContext = new Map(viewGroups.map((g) => [g.contextId, g._count.contextId]));
      copyCountByContext = new Map(copyGroups.map((g) => [g.contextId, g._count.contextId]));
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
        body: doc.body,
        status: doc.status,
        visibility: doc.visibility,
        tools: doc.tools,
        thumbnailUrl: doc.thumbnailUrl,
        thumbnailStatus: doc.thumbnailStatus,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        owner: doc.owner,
        viewCount: viewCountByContext.get(doc.id) ?? 0,
        usageCount: copyCountByContext.get(doc.id) ?? 0,
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
    let buildWhere: Prisma.BuildWhereInput = { teamId: auth.teamId };
    if (mine) {
      buildWhere.ownerId = auth.userId;
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
      buildWhere.OR = visibilityConditions;
    }
    if (q) {
      const existingAnd = Array.isArray(buildWhere.AND) ? buildWhere.AND : buildWhere.AND ? [buildWhere.AND] : [];
      buildWhere.AND = [
        ...existingAnd,
        {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
          ],
        },
      ];
    }
    if (status) {
      buildWhere.status = status;
    }

    const buildOrderBy: Prisma.BuildOrderByWithRelationInput =
      sort === "name"
        ? { title: "asc" as const }
        : sort === "updatedAt"
        ? { updatedAt: "desc" as const }
        : { createdAt: "desc" as const };

    const builds = await prisma.build.findMany({
      where: buildWhere,
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
        isSmartPick: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: buildOrderBy,
      take: pageSize * 3,
    });

    const buildIds = builds.map((b) => b.id);
    let viewCountByBuild = new Map<number, number>();
    let copyCountByBuild = new Map<number, number>();
    let favoritedBuildIds = new Set<number>();
    let favoriteCountByBuild = new Map<number, number>();
    let myRatingByBuild = new Map<number, number>();
    let ratingDataByBuild = new Map<number, { count: number; avg: number | null }>();

    if (buildIds.length > 0) {
      const [viewGroups, copyGroups, favoriteRows, favoriteCountGroups, ratingRows, ratingGroups] = await Promise.all([
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
      ]);
      viewCountByBuild = new Map(viewGroups.map((g) => [g.buildId, g._count.buildId]));
      copyCountByBuild = new Map(copyGroups.map((g) => [g.buildId, g._count.buildId]));
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
        thumbnailUrl: build.thumbnailUrl,
        thumbnailStatus: build.thumbnailStatus,
        createdAt: build.createdAt,
        updatedAt: build.updatedAt,
        owner: build.owner,
        viewCount: viewCountByBuild.get(build.id) ?? 0,
        usageCount: copyCountByBuild.get(build.id) ?? 0,
        favorited: favoritedBuildIds.has(build.id),
        favoriteCount: favoriteCountByBuild.get(build.id) ?? 0,
        ratingCount: ratingInfo?.count ?? 0,
        averageRating: ratingInfo?.avg ?? null,
        myRating: myRatingByBuild.get(build.id) ?? null,
        isSmartPick: build.isSmartPick,
      });
    }
  }

  if (sort === "mostUsed") {
    allAssets.sort((a, b) => b.usageCount - a.usageCount);
  } else if (sort === "name") {
    allAssets.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === "updatedAt") {
    allAssets.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } else {
    allAssets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  const total = allAssets.length;
  const skip = (page - 1) * pageSize;
  const paginatedAssets = allAssets.slice(skip, skip + pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const facets = {
    assetType: {
      prompt: allAssets.filter((a) => a.assetType === "prompt").length,
      skill: allAssets.filter((a) => a.assetType === "skill").length,
      context: allAssets.filter((a) => a.assetType === "context").length,
      build: allAssets.filter((a) => a.assetType === "build").length,
    },
    tool: {} as Record<string, number>,
  };

  for (const asset of allAssets) {
    for (const t of asset.tools) {
      facets.tool[t] = (facets.tool[t] ?? 0) + 1;
    }
  }

  const publishedSnapshotWhere: Prisma.PromptWhereInput = {
    teamId: auth.teamId,
    status: "PUBLISHED",
  };
  if (!isAdminOrOwner(auth.role)) {
    const snapshotVisibilityConditions: Prisma.PromptWhereInput[] = [
      { visibility: "PUBLIC" },
      { ownerId: auth.userId },
    ];
    if (auth.userOu) {
      snapshotVisibilityConditions.push({
        visibility: "TEAM",
        owner: { ou: auth.userOu },
      });
    }
    publishedSnapshotWhere.OR = snapshotVisibilityConditions;
  }

  const [promptsPublished, skillsPublished, contextPublished, buildsPublished, activeUsers, promptsUsed] = await Promise.all([
    prisma.prompt.count({ where: publishedSnapshotWhere }),
    prisma.skill.count({ where: { teamId: auth.teamId, status: "PUBLISHED" } }),
    prisma.contextDocument.count({ where: { teamId: auth.teamId, status: "PUBLISHED" } }),
    prisma.build.count({ where: { teamId: auth.teamId, status: "PUBLISHED" } }),
    prisma.user.count({ where: { teamId: auth.teamId } }),
    prisma.usageEvent.count({
      where: {
        action: { in: [UsageAction.COPY, UsageAction.LAUNCH] },
        prompt: { teamId: auth.teamId },
      },
    }),
  ]);

  return res.status(200).json({
    data: paginatedAssets,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
      facets,
      snapshot: {
        assetsPublished: promptsPublished + skillsPublished + contextPublished + buildsPublished,
        promptsPublished,
        skillsPublished,
        contextPublished,
        buildsPublished,
        activeUsers,
        promptsUsed,
      },
    },
  });
});

export { assetsRouter };
