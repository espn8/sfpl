import { PromptStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { rollingSevenDaysSince } from "../lib/rollingSevenDays";

export type ContributorRow = { id: number; email: string; name: string | null; assetCount: number };

/**
 * Owners ranked by count of assets **first published** (`publishedAt`) in the rolling 7-day window.
 * Global across all teams; any visibility.
 */
export async function getGlobalContributorsThisWeek(
  topN: number,
  nowMs: number = Date.now(),
): Promise<ContributorRow[]> {
  const since = rollingSevenDaysSince(nowMs);
  const where = {
    status: PromptStatus.PUBLISHED,
    publishedAt: { gte: since },
  };

  const [publishedPromptsByOwner, publishedSkillsByOwner, publishedContextByOwner, publishedBuildsByOwner] =
    await Promise.all([
      prisma.prompt.groupBy({
        by: ["ownerId"],
        where,
        _count: { _all: true },
      }),
      prisma.skill.groupBy({
        by: ["ownerId"],
        where,
        _count: { _all: true },
      }),
      prisma.contextDocument.groupBy({
        by: ["ownerId"],
        where,
        _count: { _all: true },
      }),
      prisma.build.groupBy({
        by: ["ownerId"],
        where,
        _count: { _all: true },
      }),
    ]);

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

  const contributorsSorted = [...assetCountByOwner.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);
  if (contributorsSorted.length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: { id: { in: contributorsSorted.map(([id]) => id) } },
    select: { id: true, email: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return contributorsSorted
    .map(([ownerId, assetCount]) => {
      const u = userMap.get(ownerId);
      if (!u) return null;
      return { id: u.id, email: u.email, name: u.name, assetCount };
    })
    .filter((row): row is ContributorRow => row !== null);
}
