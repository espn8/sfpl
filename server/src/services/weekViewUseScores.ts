import { UsageAction } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { rollingSevenDaysSince } from "../lib/rollingSevenDays";
import type { WeekTopAssetType } from "./weekTopAssets";

export type WeekViewUseRow = { assetType: WeekTopAssetType; id: number; weekScore: number };

/**
 * Global 7-day traffic: detail views + uses only (no favorites/ratings).
 * Restricted to PUBLIC + PUBLISHED assets for safe cross-team homepage surfacing.
 */
export async function getGlobalWeekViewUseScores(
  limit: number,
  nowMs: number = Date.now(),
): Promise<WeekViewUseRow[]> {
  const since = rollingSevenDaysSince(nowMs);
  const publicPublished = { status: "PUBLISHED" as const, visibility: "PUBLIC" as const };

  const [promptRows, skillRows, contextRows, buildRows] = await Promise.all([
    prisma.usageEvent.groupBy({
      by: ["promptId"],
      where: {
        createdAt: { gte: since },
        action: { in: [UsageAction.VIEW, UsageAction.COPY, UsageAction.LAUNCH] },
        prompt: publicPublished,
      },
      _count: { _all: true },
    }),
    prisma.skillUsageEvent.groupBy({
      by: ["skillId"],
      where: {
        createdAt: { gte: since },
        eventType: { in: ["VIEW", "COPY"] },
        skill: publicPublished,
      },
      _count: { _all: true },
    }),
    prisma.contextUsageEvent.groupBy({
      by: ["contextId"],
      where: {
        createdAt: { gte: since },
        eventType: { in: ["VIEW", "COPY"] },
        context: publicPublished,
      },
      _count: { _all: true },
    }),
    prisma.buildUsageEvent.groupBy({
      by: ["buildId"],
      where: {
        createdAt: { gte: since },
        eventType: { in: ["VIEW", "COPY"] },
        build: publicPublished,
      },
      _count: { _all: true },
    }),
  ]);

  const combined: WeekViewUseRow[] = [
    ...promptRows.map((r) => ({
      assetType: "prompt" as const,
      id: r.promptId,
      weekScore: r._count._all,
    })),
    ...skillRows.map((r) => ({
      assetType: "skill" as const,
      id: r.skillId,
      weekScore: r._count._all,
    })),
    ...contextRows.map((r) => ({
      assetType: "context" as const,
      id: r.contextId,
      weekScore: r._count._all,
    })),
    ...buildRows.map((r) => ({
      assetType: "build" as const,
      id: r.buildId,
      weekScore: r._count._all,
    })),
  ];

  combined.sort(
    (a, b) =>
      b.weekScore - a.weekScore ||
      a.assetType.localeCompare(b.assetType) ||
      a.id - b.id,
  );
  return combined.slice(0, limit);
}
