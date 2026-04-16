import type { Request, Response } from "express";
import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { getAuthContext, requireAuth, requireRole } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const analyticsRouter = Router();
analyticsRouter.use(requireAuth);
analyticsRouter.use(requireRole([Role.ADMIN, Role.OWNER]));

const ouQuerySchema = z.object({
  ou: z.string().trim().optional(),
});
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
    topPromptsPerOu,
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
        _count: { select: { usageEvents: true } },
      },
      orderBy: { usageEvents: { _count: "desc" } },
      take: 50,
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

  const topPromptsByOu = new Map<string, Array<{ id: number; title: string; usageCount: number }>>();
  for (const prompt of topPromptsPerOu) {
    const ou = prompt.owner.ou;
    if (ou) {
      const list = topPromptsByOu.get(ou) ?? [];
      if (list.length < 5) {
        list.push({ id: prompt.id, title: prompt.title, usageCount: prompt._count.usageEvents });
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
