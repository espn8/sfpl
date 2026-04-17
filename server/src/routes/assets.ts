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
  assetType: z.enum(["all", "prompt", "skill", "context"]).optional(),
  tool: assetToolSchema.optional(),
  sort: z.enum(["recent", "mostUsed"]).optional(),
  mine: z.coerce.boolean().optional(),
  includeAnalytics: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

type AssetType = "prompt" | "skill" | "context";

type UnifiedAsset = {
  id: number;
  assetType: AssetType;
  title: string;
  summary: string | null;
  body: string;
  status: string;
  visibility: string;
  tools: string[];
  createdAt: Date;
  updatedAt: Date;
  owner: { id: number; name: string | null; avatarUrl: string | null };
  viewCount: number;
  usageCount: number;
  favorited: boolean;
  modality?: ApiModality;
  modelHint?: string | null;
  thumbnailUrl?: string | null;
  thumbnailStatus?: string;
  averageRating?: number | null;
  myRating?: number | null;
  variables?: Array<{ key: string; label: string | null; defaultValue: string | null; required: boolean }>;
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
  const sort = parsedQuery.data.sort ?? "recent";
  const mine = parsedQuery.data.mine ?? false;
  const includeAnalytics = parsedQuery.data.includeAnalytics ?? false;
  const page = parsedQuery.data.page ?? 1;
  const pageSize = parsedQuery.data.pageSize ?? 20;

  const includePrompts = assetType === "all" || assetType === "prompt";
  const includeSkills = assetType === "all" || assetType === "skill";
  const includeContext = assetType === "all" || assetType === "context";

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

    const promptOrderBy: Prisma.PromptOrderByWithRelationInput =
      sort === "mostUsed"
        ? { usageEvents: { _count: "desc" as const } }
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
      viewCountByPrompt = new Map(viewGroups.map((g) => [g.promptId, g._count._all]));
      usageCountByPrompt = new Map(usageGroups.map((g) => [g.promptId, g._count._all]));
      favoritedPromptIds = new Set(favoriteRows.map((r) => r.promptId));
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
            { body: { contains: q, mode: "insensitive" } },
          ],
        },
      ];
    }
    if (tool) {
      skillWhere.tools = { has: tool };
    }

    const skills = await prisma.skill.findMany({
      where: skillWhere,
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
        variables: { select: { key: true, label: true, defaultValue: true, required: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: pageSize * 3,
    });

    const skillIds = skills.map((s) => s.id);
    let viewCountBySkill = new Map<number, number>();
    let copyCountBySkill = new Map<number, number>();
    let favoritedSkillIds = new Set<number>();

    if (skillIds.length > 0) {
      const [viewGroups, copyGroups, favoriteRows] = await Promise.all([
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
      ]);
      viewCountBySkill = new Map(viewGroups.map((g) => [g.skillId, g._count.skillId]));
      copyCountBySkill = new Map(copyGroups.map((g) => [g.skillId, g._count.skillId]));
      favoritedSkillIds = new Set(favoriteRows.map((r) => r.skillId));
    }

    for (const skill of skills) {
      allAssets.push({
        id: skill.id,
        assetType: "skill",
        title: skill.title,
        summary: skill.summary,
        body: skill.body,
        status: skill.status,
        visibility: skill.visibility,
        tools: skill.tools,
        createdAt: skill.createdAt,
        updatedAt: skill.updatedAt,
        owner: skill.owner,
        viewCount: viewCountBySkill.get(skill.id) ?? 0,
        usageCount: copyCountBySkill.get(skill.id) ?? 0,
        favorited: favoritedSkillIds.has(skill.id),
        variables: skill.variables,
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
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, avatarUrl: true } },
        variables: { select: { key: true, label: true, defaultValue: true, required: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: pageSize * 3,
    });

    const contextIds = contextDocs.map((c) => c.id);
    let viewCountByContext = new Map<number, number>();
    let copyCountByContext = new Map<number, number>();
    let favoritedContextIds = new Set<number>();

    if (contextIds.length > 0) {
      const [viewGroups, copyGroups, favoriteRows] = await Promise.all([
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
      ]);
      viewCountByContext = new Map(viewGroups.map((g) => [g.contextId, g._count.contextId]));
      copyCountByContext = new Map(copyGroups.map((g) => [g.contextId, g._count.contextId]));
      favoritedContextIds = new Set(favoriteRows.map((r) => r.contextId));
    }

    for (const doc of contextDocs) {
      allAssets.push({
        id: doc.id,
        assetType: "context",
        title: doc.title,
        summary: doc.summary,
        body: doc.body,
        status: doc.status,
        visibility: doc.visibility,
        tools: doc.tools,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        owner: doc.owner,
        viewCount: viewCountByContext.get(doc.id) ?? 0,
        usageCount: copyCountByContext.get(doc.id) ?? 0,
        favorited: favoritedContextIds.has(doc.id),
        variables: doc.variables,
      });
    }
  }

  if (sort === "mostUsed") {
    allAssets.sort((a, b) => b.usageCount - a.usageCount);
  } else {
    allAssets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  const total = allAssets.length;
  const skip = (page - 1) * pageSize;
  const paginatedAssets = allAssets.slice(skip, skip + pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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

  const [promptsPublished, skillsPublished, contextPublished, activeUsers, promptsUsed] = await Promise.all([
    prisma.prompt.count({ where: publishedSnapshotWhere }),
    prisma.skill.count({ where: { teamId: auth.teamId, status: "PUBLISHED" } }),
    prisma.contextDocument.count({ where: { teamId: auth.teamId, status: "PUBLISHED" } }),
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
      snapshot: {
        assetsPublished: promptsPublished + skillsPublished + contextPublished,
        promptsPublished,
        skillsPublished,
        contextPublished,
        activeUsers,
        promptsUsed,
      },
    },
  });
});

export { assetsRouter };
