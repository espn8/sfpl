import type { Request, Response } from "express";
import { Router } from "express";
import { PromptStatus, Role, UsageAction, type FeedbackFlag } from "@prisma/client";
import { z } from "zod";
import { getAuthContext, requireAuth, requireOnboardingComplete, requireRole } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { buildAggregate, computeFinalScore, DEFAULT_GLOBAL_MEAN } from "../services/scoring";
import { countFlags } from "../lib/flagCounts";

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
type UserActivityCounts = {
  usedCount: number;
  favoritedCount: number;
  ratingCount: number;
};

analyticsRouter.get("/overview", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rollingSevenDaysAgo = new Date();
  rollingSevenDaysAgo.setDate(rollingSevenDaysAgo.getDate() - 7);

  /** Published team assets first created in the rolling 7-day window (home / analytics “This Week”). */
  const publishedAssetThisWeekWhere = {
    teamId: auth.teamId,
    status: PromptStatus.PUBLISHED,
    createdAt: { gte: rollingSevenDaysAgo },
  };
  /** Limit engagement metrics to assets in this workspace (matches contributor / top-used scope). */
  const teamCatalogWhere = { teamId: auth.teamId };

  const [
    topUsedGroups,
    topRated,
    stalePrompts,
    promptUsesByUser,
    skillCopiesByUser,
    contextCopiesByUser,
    buildCopiesByUser,
    promptFavoritesByUser,
    skillFavoritesByUser,
    contextFavoritesByUser,
    buildFavoritesByUser,
    promptRatingsByUser,
    skillRatingsByUser,
    contextRatingsByUser,
    buildRatingsByUser,
    publishedPromptsByOwner,
    publishedSkillsByOwner,
    publishedContextByOwner,
    publishedBuildsByOwner,
  ] = await Promise.all([
    prisma.usageEvent.groupBy({
      by: ["promptId"],
      where: {
        prompt: teamCatalogWhere,
        action: { in: [UsageAction.COPY, UsageAction.LAUNCH] },
      },
      _count: { _all: true },
      orderBy: { _count: { promptId: "desc" } },
      take: 10,
    }),
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
    prisma.usageEvent.groupBy({
      by: ["userId"],
      where: {
        user: { teamId: auth.teamId },
        prompt: teamCatalogWhere,
        action: { in: [UsageAction.COPY, UsageAction.LAUNCH] },
        createdAt: { gte: rollingSevenDaysAgo },
      },
      _count: { _all: true },
    }),
    prisma.skillUsageEvent.groupBy({
      by: ["userId"],
      where: {
        user: { teamId: auth.teamId },
        skill: teamCatalogWhere,
        eventType: "COPY",
        createdAt: { gte: rollingSevenDaysAgo },
      },
      _count: { _all: true },
    }),
    prisma.contextUsageEvent.groupBy({
      by: ["userId"],
      where: {
        user: { teamId: auth.teamId },
        context: teamCatalogWhere,
        eventType: "COPY",
        createdAt: { gte: rollingSevenDaysAgo },
      },
      _count: { _all: true },
    }),
    prisma.buildUsageEvent.groupBy({
      by: ["userId"],
      where: {
        user: { teamId: auth.teamId },
        build: teamCatalogWhere,
        eventType: "COPY",
        createdAt: { gte: rollingSevenDaysAgo },
      },
      _count: { _all: true },
    }),
    prisma.favorite.groupBy({
      by: ["userId"],
      where: {
        user: { teamId: auth.teamId },
        prompt: teamCatalogWhere,
        createdAt: { gte: rollingSevenDaysAgo },
      },
      _count: { _all: true },
    }),
    prisma.skillFavorite.groupBy({
      by: ["userId"],
      where: {
        user: { teamId: auth.teamId },
        skill: teamCatalogWhere,
        createdAt: { gte: rollingSevenDaysAgo },
      },
      _count: { _all: true },
    }),
    prisma.contextFavorite.groupBy({
      by: ["userId"],
      where: {
        user: { teamId: auth.teamId },
        context: teamCatalogWhere,
        createdAt: { gte: rollingSevenDaysAgo },
      },
      _count: { _all: true },
    }),
    prisma.buildFavorite.groupBy({
      by: ["userId"],
      where: {
        user: { teamId: auth.teamId },
        build: teamCatalogWhere,
        createdAt: { gte: rollingSevenDaysAgo },
      },
      _count: { _all: true },
    }),
    prisma.rating.groupBy({
      by: ["userId"],
      where: {
        user: { teamId: auth.teamId },
        prompt: teamCatalogWhere,
        updatedAt: { gte: rollingSevenDaysAgo },
      },
      _count: { _all: true },
    }),
    prisma.skillRating.groupBy({
      by: ["userId"],
      where: {
        user: { teamId: auth.teamId },
        skill: teamCatalogWhere,
        updatedAt: { gte: rollingSevenDaysAgo },
      },
      _count: { _all: true },
    }),
    prisma.contextRating.groupBy({
      by: ["userId"],
      where: {
        user: { teamId: auth.teamId },
        context: teamCatalogWhere,
        updatedAt: { gte: rollingSevenDaysAgo },
      },
      _count: { _all: true },
    }),
    prisma.buildRating.groupBy({
      by: ["userId"],
      where: {
        user: { teamId: auth.teamId },
        build: teamCatalogWhere,
        updatedAt: { gte: rollingSevenDaysAgo },
      },
      _count: { _all: true },
    }),
    prisma.prompt.groupBy({
      by: ["ownerId"],
      where: publishedAssetThisWeekWhere,
      _count: { _all: true },
    }),
    prisma.skill.groupBy({
      by: ["ownerId"],
      where: publishedAssetThisWeekWhere,
      _count: { _all: true },
    }),
    prisma.contextDocument.groupBy({
      by: ["ownerId"],
      where: publishedAssetThisWeekWhere,
      _count: { _all: true },
    }),
    prisma.build.groupBy({
      by: ["ownerId"],
      where: publishedAssetThisWeekWhere,
      _count: { _all: true },
    }),
  ]);

  const topUsedPromptIds = topUsedGroups.map((g) => g.promptId);
  const topUsedPromptDetails =
    topUsedPromptIds.length > 0
      ? await prisma.prompt.findMany({
          where: { id: { in: topUsedPromptIds } },
          select: { id: true, title: true },
        })
      : [];
  const topUsedPromptMap = new Map(topUsedPromptDetails.map((p) => [p.id, p.title]));
  const topUsed = topUsedGroups.map((g) => ({
    id: g.promptId,
    title: topUsedPromptMap.get(g.promptId) ?? "Unknown",
    usageCount: g._count._all,
  }));

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

  const userActivityMap = new Map<number, UserActivityCounts>();

  const bumpUsed = (userId: number, delta: number) => {
    const cur = userActivityMap.get(userId) ?? { usedCount: 0, favoritedCount: 0, ratingCount: 0 };
    cur.usedCount += delta;
    userActivityMap.set(userId, cur);
  };
  const bumpFavorited = (userId: number, delta: number) => {
    const cur = userActivityMap.get(userId) ?? { usedCount: 0, favoritedCount: 0, ratingCount: 0 };
    cur.favoritedCount += delta;
    userActivityMap.set(userId, cur);
  };
  const bumpRating = (userId: number, delta: number) => {
    const cur = userActivityMap.get(userId) ?? { usedCount: 0, favoritedCount: 0, ratingCount: 0 };
    cur.ratingCount += delta;
    userActivityMap.set(userId, cur);
  };

  for (const row of promptUsesByUser) bumpUsed(row.userId, row._count._all);
  for (const row of skillCopiesByUser) bumpUsed(row.userId, row._count._all);
  for (const row of contextCopiesByUser) bumpUsed(row.userId, row._count._all);
  for (const row of buildCopiesByUser) bumpUsed(row.userId, row._count._all);

  for (const row of promptFavoritesByUser) bumpFavorited(row.userId, row._count._all);
  for (const row of skillFavoritesByUser) bumpFavorited(row.userId, row._count._all);
  for (const row of contextFavoritesByUser) bumpFavorited(row.userId, row._count._all);
  for (const row of buildFavoritesByUser) bumpFavorited(row.userId, row._count._all);

  for (const row of promptRatingsByUser) bumpRating(row.userId, row._count._all);
  for (const row of skillRatingsByUser) bumpRating(row.userId, row._count._all);
  for (const row of contextRatingsByUser) bumpRating(row.userId, row._count._all);
  for (const row of buildRatingsByUser) bumpRating(row.userId, row._count._all);

  const assetCountByOwner = new Map<number, number>();
  for (const row of publishedPromptsByOwner) {
    assetCountByOwner.set(row.ownerId, (assetCountByOwner.get(row.ownerId) ?? 0) + row._count._all);
  }
  for (const row of publishedSkillsByOwner) {
    assetCountByOwner.set(row.ownerId, (assetCountByOwner.get(row.ownerId) ?? 0) + row._count._all);
  }
  for (const row of publishedContextByOwner) {
    assetCountByOwner.set(row.ownerId, (assetCountByOwner.get(row.ownerId) ?? 0) + row._count._all);
  }
  for (const row of publishedBuildsByOwner) {
    assetCountByOwner.set(row.ownerId, (assetCountByOwner.get(row.ownerId) ?? 0) + row._count._all);
  }

  const contributorsSorted = [...assetCountByOwner.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const contributorUsers =
    contributorsSorted.length > 0
      ? await prisma.user.findMany({
          where: { teamId: auth.teamId, id: { in: contributorsSorted.map(([id]) => id) } },
          select: { id: true, email: true, name: true },
        })
      : [];
  const contributorUserMap = new Map(contributorUsers.map((u) => [u.id, u]));
  const contributors = contributorsSorted
    .map(([ownerId, assetCount]) => {
      const u = contributorUserMap.get(ownerId);
      if (!u) return null;
      return { id: u.id, email: u.email, name: u.name, assetCount };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const leaderboardUserIds = Array.from(userActivityMap.keys());
  const leaderboardUsers =
    leaderboardUserIds.length > 0
      ? await prisma.user.findMany({
          where: {
            teamId: auth.teamId,
            id: { in: leaderboardUserIds },
          },
          select: {
            id: true,
            email: true,
            name: true,
          },
        })
      : [];
  const leaderboardUserMap = new Map(leaderboardUsers.map((user) => [user.id, user]));

  const userEngagementLeaderboard = leaderboardUserIds
    .map((userId) => {
      const activity = userActivityMap.get(userId);
      const user = leaderboardUserMap.get(userId);
      if (!activity || !user) {
        return null;
      }
      const score = activity.usedCount + activity.favoritedCount + activity.ratingCount;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        score,
        usedCount: activity.usedCount,
        favoritedCount: activity.favoritedCount,
        ratingCount: activity.ratingCount,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.score - a.score || b.usedCount - a.usedCount || b.ratingCount - a.ratingCount)
    .slice(0, 10);

  return res.status(200).json({
    data: {
      topUsedPrompts: topUsed,
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
