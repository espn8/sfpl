import type { Request, Response } from "express";
import { Router } from "express";
import { Role } from "@prisma/client";
import { getAuthContext, requireAuth, requireRole } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const analyticsRouter = Router();
analyticsRouter.use(requireAuth);
analyticsRouter.use(requireRole([Role.ADMIN, Role.OWNER]));
type RatedPrompt = {
  id: number;
  title: string;
  ratings: Array<{ value: number }>;
};
type UserActivityCounts = {
  usedCount: number;
  favoritedCount: number;
  feedbackCount: number;
};

analyticsRouter.get("/overview", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [topUsed, topRated, stalePrompts, contributors, usageByUser, favoritesByUser, feedbackByUser] = await Promise.all([
    prisma.prompt.findMany({
      where: { teamId: auth.teamId },
      select: {
        id: true,
        title: true,
        _count: { select: { usageEvents: true } },
      },
      orderBy: { usageEvents: { _count: "desc" } },
      take: 10,
    }),
    prisma.prompt.findMany({
      where: { teamId: auth.teamId },
      select: {
        id: true,
        title: true,
        ratings: { select: { value: true } },
      },
      take: 10,
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
    prisma.user.findMany({
      where: { teamId: auth.teamId },
      select: {
        id: true,
        email: true,
        name: true,
        _count: { select: { prompts: true } },
      },
      orderBy: { prompts: { _count: "desc" } },
      take: 10,
    }),
    prisma.usageEvent.groupBy({
      by: ["userId"],
      where: {
        user: {
          teamId: auth.teamId,
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.favorite.groupBy({
      by: ["userId"],
      where: {
        user: {
          teamId: auth.teamId,
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.rating.groupBy({
      by: ["userId"],
      where: {
        user: {
          teamId: auth.teamId,
        },
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  const topRatedWithAverage = (topRated as RatedPrompt[])
    .map((prompt: RatedPrompt) => ({
      id: prompt.id,
      title: prompt.title,
      averageRating:
        prompt.ratings.length === 0
          ? null
          : prompt.ratings.reduce((sum: number, item: { value: number }) => sum + item.value, 0) / prompt.ratings.length,
      ratingCount: prompt.ratings.length,
    }))
    .sort((a: { averageRating: number | null }, b: { averageRating: number | null }) => (b.averageRating ?? 0) - (a.averageRating ?? 0))
    .slice(0, 10);

  const userActivityMap = new Map<number, UserActivityCounts>();
  for (const row of usageByUser) {
    userActivityMap.set(row.userId, {
      usedCount: row._count._all,
      favoritedCount: 0,
      feedbackCount: 0,
    });
  }
  for (const row of favoritesByUser) {
    const existing = userActivityMap.get(row.userId);
    userActivityMap.set(row.userId, {
      usedCount: existing?.usedCount ?? 0,
      favoritedCount: row._count._all,
      feedbackCount: existing?.feedbackCount ?? 0,
    });
  }
  for (const row of feedbackByUser) {
    const existing = userActivityMap.get(row.userId);
    userActivityMap.set(row.userId, {
      usedCount: existing?.usedCount ?? 0,
      favoritedCount: existing?.favoritedCount ?? 0,
      feedbackCount: row._count._all,
    });
  }

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
      const score = activity.usedCount + activity.favoritedCount + activity.feedbackCount;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        score,
        usedCount: activity.usedCount,
        favoritedCount: activity.favoritedCount,
        feedbackCount: activity.feedbackCount,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.score - a.score || b.usedCount - a.usedCount || b.feedbackCount - a.feedbackCount)
    .slice(0, 10);

  return res.status(200).json({
    data: {
      topUsedPrompts: topUsed.map((prompt: { id: number; title: string; _count: { usageEvents: number } }) => ({
        id: prompt.id,
        title: prompt.title,
        usageCount: prompt._count.usageEvents,
      })),
      topRatedPrompts: topRatedWithAverage,
      stalePrompts: stalePrompts.map((prompt: { id: number; title: string; updatedAt: Date }) => ({
        id: prompt.id,
        title: prompt.title,
        updatedAt: prompt.updatedAt,
      })),
      contributors: contributors.map((user: { id: number; email: string; name: string | null; _count: { prompts: number } }) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        promptCount: user._count.prompts,
      })),
      userEngagementLeaderboard,
    },
  });
});

export { analyticsRouter };
