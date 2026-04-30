import { UsageAction } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { rollingSevenDaysSince } from "../lib/rollingSevenDays";

export type MostActiveRow = {
  id: number;
  email: string;
  name: string | null;
  score: number;
  firstPublishCount: number;
  viewCount: number;
  useCount: number;
  favoritedCount: number;
  collectionAddCount: number;
  ratingCount: number;
};

function bump(map: Map<number, number>, userId: number, delta: number): void {
  map.set(userId, (map.get(userId) ?? 0) + delta);
}

function addGroupByOwner(rows: { ownerId: number; _count: { _all: number } }[], map: Map<number, number>): void {
  for (const row of rows) {
    bump(map, row.ownerId, row._count._all);
  }
}

function addGroupByUserId(rows: { userId: number; _count: { _all: number } }[], map: Map<number, number>): void {
  for (const row of rows) {
    bump(map, row.userId, row._count._all);
  }
}

function addGroupByAddedBy(rows: { addedById: number; _count: { _all: number } }[], map: Map<number, number>): void {
  for (const row of rows) {
    bump(map, row.addedById, row._count._all);
  }
}

function totalScore(
  userId: number,
  firstPublish: Map<number, number>,
  views: Map<number, number>,
  uses: Map<number, number>,
  favorites: Map<number, number>,
  collectionAdds: Map<number, number>,
  ratings: Map<number, number>,
): number {
  return (
    (firstPublish.get(userId) ?? 0) +
    (views.get(userId) ?? 0) +
    (uses.get(userId) ?? 0) +
    (favorites.get(userId) ?? 0) +
    (collectionAdds.get(userId) ?? 0) +
    (ratings.get(userId) ?? 0)
  );
}

/**
 * Rolling 7 days, +1 per: first publish (owner), detail view, use, favorite, collection add, new rating (rater).
 * Global — no team filter on facts.
 */
export async function getGlobalMostActiveThisWeek(topN: number, nowMs: number = Date.now()): Promise<MostActiveRow[]> {
  const since = rollingSevenDaysSince(nowMs);
  const firstPublish = new Map<number, number>();
  const views = new Map<number, number>();
  const uses = new Map<number, number>();
  const favorites = new Map<number, number>();
  const collectionAdds = new Map<number, number>();
  const ratings = new Map<number, number>();

  const [
    publishedPromptsByOwner,
    publishedSkillsByOwner,
    publishedContextByOwner,
    publishedBuildsByOwner,
    promptViewsByUser,
    skillViewsByUser,
    contextViewsByUser,
    buildViewsByUser,
    promptUsesByUser,
    skillCopiesByUser,
    contextCopiesByUser,
    buildCopiesByUser,
    promptFavoritesByUser,
    skillFavoritesByUser,
    contextFavoritesByUser,
    buildFavoritesByUser,
    promptCollectionAdds,
    skillCollectionAdds,
    contextCollectionAdds,
    buildCollectionAdds,
    promptRatingsByUser,
    skillRatingsByUser,
    contextRatingsByUser,
    buildRatingsByUser,
  ] = await Promise.all([
    prisma.prompt.groupBy({
      by: ["ownerId"],
      where: { status: "PUBLISHED", publishedAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.skill.groupBy({
      by: ["ownerId"],
      where: { status: "PUBLISHED", publishedAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.contextDocument.groupBy({
      by: ["ownerId"],
      where: { status: "PUBLISHED", publishedAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.build.groupBy({
      by: ["ownerId"],
      where: { status: "PUBLISHED", publishedAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.usageEvent.groupBy({
      by: ["userId"],
      where: { action: UsageAction.VIEW, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.skillUsageEvent.groupBy({
      by: ["userId"],
      where: { eventType: "VIEW", createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.contextUsageEvent.groupBy({
      by: ["userId"],
      where: { eventType: "VIEW", createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.buildUsageEvent.groupBy({
      by: ["userId"],
      where: { eventType: "VIEW", createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.usageEvent.groupBy({
      by: ["userId"],
      where: { action: { in: [UsageAction.COPY, UsageAction.LAUNCH] }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.skillUsageEvent.groupBy({
      by: ["userId"],
      where: { eventType: "COPY", createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.contextUsageEvent.groupBy({
      by: ["userId"],
      where: { eventType: "COPY", createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.buildUsageEvent.groupBy({
      by: ["userId"],
      where: { eventType: "COPY", createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.favorite.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.skillFavorite.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.contextFavorite.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.buildFavorite.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.collectionPrompt.groupBy({
      by: ["addedById"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.collectionSkill.groupBy({
      by: ["addedById"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.collectionContext.groupBy({
      by: ["addedById"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.collectionBuild.groupBy({
      by: ["addedById"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.rating.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.skillRating.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.contextRating.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.buildRating.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  addGroupByOwner(publishedPromptsByOwner, firstPublish);
  addGroupByOwner(publishedSkillsByOwner, firstPublish);
  addGroupByOwner(publishedContextByOwner, firstPublish);
  addGroupByOwner(publishedBuildsByOwner, firstPublish);

  addGroupByUserId(promptViewsByUser, views);
  addGroupByUserId(skillViewsByUser, views);
  addGroupByUserId(contextViewsByUser, views);
  addGroupByUserId(buildViewsByUser, views);

  addGroupByUserId(promptUsesByUser, uses);
  addGroupByUserId(skillCopiesByUser, uses);
  addGroupByUserId(contextCopiesByUser, uses);
  addGroupByUserId(buildCopiesByUser, uses);

  addGroupByUserId(promptFavoritesByUser, favorites);
  addGroupByUserId(skillFavoritesByUser, favorites);
  addGroupByUserId(contextFavoritesByUser, favorites);
  addGroupByUserId(buildFavoritesByUser, favorites);

  addGroupByAddedBy(promptCollectionAdds, collectionAdds);
  addGroupByAddedBy(skillCollectionAdds, collectionAdds);
  addGroupByAddedBy(contextCollectionAdds, collectionAdds);
  addGroupByAddedBy(buildCollectionAdds, collectionAdds);

  addGroupByUserId(promptRatingsByUser, ratings);
  addGroupByUserId(skillRatingsByUser, ratings);
  addGroupByUserId(contextRatingsByUser, ratings);
  addGroupByUserId(buildRatingsByUser, ratings);

  const allUserIds = new Set<number>([
    ...firstPublish.keys(),
    ...views.keys(),
    ...uses.keys(),
    ...favorites.keys(),
    ...collectionAdds.keys(),
    ...ratings.keys(),
  ]);

  const scored = [...allUserIds]
    .map((userId) => ({
      userId,
      score: totalScore(userId, firstPublish, views, uses, favorites, collectionAdds, ratings),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.userId - b.userId)
    .slice(0, topN);

  if (scored.length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: { id: { in: scored.map((s) => s.userId) } },
    select: { id: true, email: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return scored
    .map(({ userId, score }) => {
      const u = userMap.get(userId);
      if (!u) return null;
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        score,
        firstPublishCount: firstPublish.get(userId) ?? 0,
        viewCount: views.get(userId) ?? 0,
        useCount: uses.get(userId) ?? 0,
        favoritedCount: favorites.get(userId) ?? 0,
        collectionAddCount: collectionAdds.get(userId) ?? 0,
        ratingCount: ratings.get(userId) ?? 0,
      };
    })
    .filter((row): row is MostActiveRow => row !== null);
}
