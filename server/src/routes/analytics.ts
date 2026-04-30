import type { Request, Response } from "express";
import { Router } from "express";
import { PromptStatus, Role, UsageAction, type FeedbackFlag } from "@prisma/client";
import { z } from "zod";
import { getAuthContext, requireAuth, requireOnboardingComplete, requireRole } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { buildAggregate, computeFinalScore, DEFAULT_GLOBAL_MEAN } from "../services/scoring";
import { countFlags } from "../lib/flagCounts";
import { getGlobalContributorsThisWeek } from "../services/globalContributorsThisWeek";
import { getGlobalMostActiveThisWeek } from "../services/globalMostActiveThisWeek";

const analyticsRouter = Router();
analyticsRouter.use(requireAuth);
analyticsRouter.use(requireOnboardingComplete);
analyticsRouter.use(requireRole([Role.ADMIN, Role.OWNER]));

const ouQuerySchema = z.object({
  ou: z.string().trim().optional(),
});
type RatedPrompt = {
  id: number;
  title: string;
  ratings: Array<{ value: number; feedbackFlags: FeedbackFlag[] }>;
};

analyticsRouter.get("/overview", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  /** Limit “most used” assets to this workspace (admin analytics). */
  const teamCatalogWhere = { teamId: auth.teamId };

  const TOP_USED_CANDIDATES_PER_TYPE = 30;
  const [topUsedPromptGroups, topUsedSkillGroups, topUsedContextGroups, topUsedBuildGroups] = await Promise.all([
    prisma.usageEvent.groupBy({
      by: ["promptId"],
      where: {
        prompt: teamCatalogWhere,
        action: { in: [UsageAction.COPY, UsageAction.LAUNCH] },
      },
      _count: { _all: true },
      orderBy: { _count: { promptId: "desc" } },
      take: TOP_USED_CANDIDATES_PER_TYPE,
    }),
    prisma.skillUsageEvent.groupBy({
      by: ["skillId"],
      where: { skill: teamCatalogWhere, eventType: "COPY" },
      _count: { _all: true },
      orderBy: { _count: { skillId: "desc" } },
      take: TOP_USED_CANDIDATES_PER_TYPE,
    }),
    prisma.contextUsageEvent.groupBy({
      by: ["contextId"],
      where: { context: teamCatalogWhere, eventType: "COPY" },
      _count: { _all: true },
      orderBy: { _count: { contextId: "desc" } },
      take: TOP_USED_CANDIDATES_PER_TYPE,
    }),
    prisma.buildUsageEvent.groupBy({
      by: ["buildId"],
      where: { build: teamCatalogWhere, eventType: "COPY" },
      _count: { _all: true },
      orderBy: { _count: { buildId: "desc" } },
      take: TOP_USED_CANDIDATES_PER_TYPE,
    }),
  ]);

  const mergedTopUsed = [
    ...topUsedPromptGroups.map((g) => ({
      assetType: "prompt" as const,
      id: g.promptId,
      usageCount: g._count._all,
    })),
    ...topUsedSkillGroups.map((g) => ({
      assetType: "skill" as const,
      id: g.skillId,
      usageCount: g._count._all,
    })),
    ...topUsedContextGroups.map((g) => ({
      assetType: "context" as const,
      id: g.contextId,
      usageCount: g._count._all,
    })),
    ...topUsedBuildGroups.map((g) => ({
      assetType: "build" as const,
      id: g.buildId,
      usageCount: g._count._all,
    })),
  ].sort((a, b) => b.usageCount - a.usageCount || a.assetType.localeCompare(b.assetType) || a.id - b.id);

  const mergedTopUsedSlice = mergedTopUsed.slice(0, 10);
  const promptTopIds = mergedTopUsedSlice.filter((r) => r.assetType === "prompt").map((r) => r.id);
  const skillTopIds = mergedTopUsedSlice.filter((r) => r.assetType === "skill").map((r) => r.id);
  const contextTopIds = mergedTopUsedSlice.filter((r) => r.assetType === "context").map((r) => r.id);
  const buildTopIds = mergedTopUsedSlice.filter((r) => r.assetType === "build").map((r) => r.id);

  const [promptTopRows, skillTopRows, contextTopRows, buildTopRows] = await Promise.all([
    promptTopIds.length > 0
      ? prisma.prompt.findMany({ where: { id: { in: promptTopIds } }, select: { id: true, title: true } })
      : Promise.resolve([]),
    skillTopIds.length > 0
      ? prisma.skill.findMany({ where: { id: { in: skillTopIds } }, select: { id: true, title: true } })
      : Promise.resolve([]),
    contextTopIds.length > 0
      ? prisma.contextDocument.findMany({ where: { id: { in: contextTopIds } }, select: { id: true, title: true } })
      : Promise.resolve([]),
    buildTopIds.length > 0
      ? prisma.build.findMany({ where: { id: { in: buildTopIds } }, select: { id: true, title: true } })
      : Promise.resolve([]),
  ]);

  const topUsedTitleByKey = new Map<string, string>();
  for (const row of promptTopRows) {
    topUsedTitleByKey.set(`prompt:${row.id}`, row.title);
  }
  for (const row of skillTopRows) {
    topUsedTitleByKey.set(`skill:${row.id}`, row.title);
  }
  for (const row of contextTopRows) {
    topUsedTitleByKey.set(`context:${row.id}`, row.title);
  }
  for (const row of buildTopRows) {
    topUsedTitleByKey.set(`build:${row.id}`, row.title);
  }

  const topUsedAssets = mergedTopUsedSlice.map((row) => ({
    assetType: row.assetType,
    id: row.id,
    title: topUsedTitleByKey.get(`${row.assetType}:${row.id}`) ?? "Unknown",
    usageCount: row.usageCount,
  }));

  const [
    topRated,
    stalePrompts,
    contributors,
    mostActiveRows,
  ] = await Promise.all([
    prisma.prompt.findMany({
      where: {
        teamId: auth.teamId,
        status: "PUBLISHED",
        OR: [{ verificationDueAt: null }, { verificationDueAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        title: true,
        ratings: { select: { value: true, feedbackFlags: true } },
      },
    }),
    prisma.prompt.findMany({
      where: {
        teamId: auth.teamId,
        usageEvents: { none: { createdAt: { gte: thirtyDaysAgo } } },
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
      },
      take: 10,
      orderBy: { updatedAt: "asc" },
    }),
    getGlobalContributorsThisWeek(10),
    getGlobalMostActiveThisWeek(10),
  ]);

  const topRatedPrompts = topRated as RatedPrompt[];
  const allRatingValues = topRatedPrompts.flatMap((p) => p.ratings.map((r) => r.value));
  const teamGlobalMean =
    allRatingValues.length === 0
      ? DEFAULT_GLOBAL_MEAN
      : allRatingValues.reduce((s, v) => s + v, 0) / allRatingValues.length;

  const topRatedWithAverage = topRatedPrompts
    .map((prompt) => {
      const agg = buildAggregate(prompt.ratings);
      return {
        id: prompt.id,
        title: prompt.title,
        averageRating: agg.count === 0 ? null : agg.average,
        ratingCount: agg.count,
        score: computeFinalScore(agg, teamGlobalMean),
        flagCounts: countFlags(prompt.ratings),
      };
    })
    .sort((a, b) => b.score - a.score || b.ratingCount - a.ratingCount)
    .slice(0, 10);

  const userEngagementLeaderboard = mostActiveRows;

  return res.status(200).json({
    data: {
      topUsedAssets,
      topRatedPrompts: topRatedWithAverage,
      stalePrompts: stalePrompts.map((prompt: { id: number; title: string; updatedAt: Date }) => ({
        id: prompt.id,
        title: prompt.title,
        updatedAt: prompt.updatedAt,
      })),
      contributors,
      userEngagementLeaderboard,
    },
  });
});

analyticsRouter.get("/ou", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedQuery = ouQuerySchema.safeParse(req.query);
  const filterOu = parsedQuery.success ? parsedQuery.data.ou : undefined;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const userWhereClause = filterOu
    ? { teamId: auth.teamId, ou: filterOu }
    : { teamId: auth.teamId, ou: { not: null } };

  const [
    usersByOu,
    promptsByOwnerOu,
    usageEventsByUserOu,
    promptsForTopByOu,
    usageCountsByPrompt,
  ] = await Promise.all([
    prisma.user.groupBy({
      by: ["ou"],
      where: userWhereClause,
      _count: { _all: true },
    }),
    prisma.prompt.findMany({
      where: {
        teamId: auth.teamId,
        owner: filterOu ? { ou: filterOu } : { ou: { not: null } },
      },
      select: {
        id: true,
        owner: { select: { ou: true } },
      },
    }),
    prisma.usageEvent.findMany({
      where: {
        user: filterOu ? { teamId: auth.teamId, ou: filterOu } : { teamId: auth.teamId, ou: { not: null } },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        action: true,
        user: { select: { ou: true } },
      },
    }),
    prisma.prompt.findMany({
      where: {
        teamId: auth.teamId,
        owner: filterOu ? { ou: filterOu } : { ou: { not: null } },
        status: "PUBLISHED",
      },
      select: {
        id: true,
        title: true,
        owner: { select: { ou: true } },
      },
    }),
    prisma.usageEvent.groupBy({
      by: ["promptId"],
      where: {
        prompt: {
          teamId: auth.teamId,
          owner: filterOu ? { ou: filterOu } : { ou: { not: null } },
          status: "PUBLISHED",
        },
        action: { in: [UsageAction.COPY, UsageAction.LAUNCH] },
      },
      _count: { _all: true },
    }),
  ]);

  const promptCountByOu = new Map<string, number>();
  for (const prompt of promptsByOwnerOu) {
    const ou = prompt.owner.ou;
    if (ou) {
      promptCountByOu.set(ou, (promptCountByOu.get(ou) ?? 0) + 1);
    }
  }

  const usageByOu = new Map<string, { views: number; copies: number; launches: number }>();
  for (const event of usageEventsByUserOu) {
    const ou = event.user.ou;
    if (ou) {
      const existing = usageByOu.get(ou) ?? { views: 0, copies: 0, launches: 0 };
      if (event.action === "VIEW") {
        existing.views += 1;
      } else if (event.action === "COPY") {
        existing.copies += 1;
      } else if (event.action === "LAUNCH") {
        existing.launches += 1;
      }
      usageByOu.set(ou, existing);
    }
  }

  const usageCountMap = new Map(usageCountsByPrompt.map((g) => [g.promptId, g._count._all]));
  const promptsWithUsage = promptsForTopByOu
    .map((p) => ({
      id: p.id,
      title: p.title,
      ou: p.owner.ou,
      usageCount: usageCountMap.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.usageCount - a.usageCount);

  const topPromptsByOu = new Map<string, Array<{ id: number; title: string; usageCount: number }>>();
  for (const prompt of promptsWithUsage) {
    const ou = prompt.ou;
    if (ou) {
      const list = topPromptsByOu.get(ou) ?? [];
      if (list.length < 5) {
        list.push({ id: prompt.id, title: prompt.title, usageCount: prompt.usageCount });
      }
      topPromptsByOu.set(ou, list);
    }
  }

  const ouBreakdown = usersByOu
    .filter((row): row is typeof row & { ou: string } => row.ou !== null)
    .map((row) => ({
      ou: row.ou,
      userCount: row._count._all,
      promptCount: promptCountByOu.get(row.ou) ?? 0,
      usage: usageByOu.get(row.ou) ?? { views: 0, copies: 0, launches: 0 },
      topPrompts: topPromptsByOu.get(row.ou) ?? [],
    }))
    .sort((a, b) => b.userCount - a.userCount);

  const totalUsers = ouBreakdown.reduce((sum, ou) => sum + ou.userCount, 0);
  const totalPrompts = ouBreakdown.reduce((sum, ou) => sum + ou.promptCount, 0);
  const totalUsage = ouBreakdown.reduce(
    (sum, ou) => ({
      views: sum.views + ou.usage.views,
      copies: sum.copies + ou.usage.copies,
      launches: sum.launches + ou.usage.launches,
    }),
    { views: 0, copies: 0, launches: 0 },
  );

  return res.status(200).json({
    data: {
      summary: {
        totalOus: ouBreakdown.length,
        totalUsers,
        totalPrompts,
        totalUsage,
      },
      ouBreakdown,
    },
  });
});

export { analyticsRouter };
