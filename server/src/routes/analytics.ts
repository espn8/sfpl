import type { Request, Response } from "express";
import { Router } from "express";
import { getAuthContext, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

analyticsRouter.get("/overview", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [topUsed, topRated, stalePrompts, contributors] = await Promise.all([
    prisma.prompt.findMany({
      where: { teamId: auth.teamId },
      include: { _count: { select: { usageEvents: true } } },
      orderBy: { usageEvents: { _count: "desc" } },
      take: 10,
    }),
    prisma.prompt.findMany({
      where: { teamId: auth.teamId },
      include: { ratings: { select: { value: true } } },
      take: 10,
    }),
    prisma.prompt.findMany({
      where: {
        teamId: auth.teamId,
        usageEvents: { none: { createdAt: { gte: thirtyDaysAgo } } },
      },
      take: 10,
      orderBy: { updatedAt: "asc" },
    }),
    prisma.user.findMany({
      where: { teamId: auth.teamId },
      include: { _count: { select: { prompts: true } } },
      orderBy: { prompts: { _count: "desc" } },
      take: 10,
    }),
  ]);

  const topRatedWithAverage = topRated
    .map((prompt) => ({
      id: prompt.id,
      title: prompt.title,
      averageRating:
        prompt.ratings.length === 0
          ? null
          : prompt.ratings.reduce((sum, item) => sum + item.value, 0) / prompt.ratings.length,
      ratingCount: prompt.ratings.length,
    }))
    .sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0))
    .slice(0, 10);

  return res.status(200).json({
    data: {
      topUsedPrompts: topUsed.map((prompt) => ({
        id: prompt.id,
        title: prompt.title,
        usageCount: prompt._count.usageEvents,
      })),
      topRatedPrompts: topRatedWithAverage,
      stalePrompts: stalePrompts.map((prompt) => ({
        id: prompt.id,
        title: prompt.title,
        updatedAt: prompt.updatedAt,
      })),
      contributors: contributors.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        promptCount: user._count.prompts,
      })),
    },
  });
});

export { analyticsRouter };
