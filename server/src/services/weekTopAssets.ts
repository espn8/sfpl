import { UsageAction } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { rollingSevenDaysSince } from "../lib/rollingSevenDays";

export const WEEK_TOP_ASSETS_MS = 7 * 24 * 60 * 60 * 1000;
/** Max assets flagged as “top this week” for a team (all types combined). */
export const WEEK_TOP_ASSET_LIMIT = 15;

export type WeekTopAssetType = "prompt" | "skill" | "context" | "build";

export function weekTopAssetKey(assetType: WeekTopAssetType, id: number): string {
  return `${assetType}:${id}`;
}

type ScoredRow = { key: string; count: bigint };

/**
 * Returns asset keys (`prompt:12`, `skill:3`, …) for this team’s highest-traffic
 * published assets in the rolling last 7 days: detail views + uses only.
 */
export async function getWeekTopAssetKeySet(teamId: number, nowMs: number = Date.now()): Promise<Set<string>> {
  const since = rollingSevenDaysSince(nowMs);

  const [promptRows, skillRows, contextRows, buildRows] = await Promise.all([
    prisma.usageEvent.groupBy({
      by: ["promptId"],
      where: {
        createdAt: { gte: since },
        action: { in: [UsageAction.VIEW, UsageAction.COPY, UsageAction.LAUNCH] },
        prompt: { teamId, status: "PUBLISHED" },
      },
      _count: { _all: true },
    }),
    prisma.skillUsageEvent.groupBy({
      by: ["skillId"],
      where: {
        createdAt: { gte: since },
        eventType: { in: ["VIEW", "COPY"] },
        skill: { teamId, status: "PUBLISHED" },
      },
      _count: { _all: true },
    }),
    prisma.contextUsageEvent.groupBy({
      by: ["contextId"],
      where: {
        createdAt: { gte: since },
        eventType: { in: ["VIEW", "COPY"] },
        context: { teamId, status: "PUBLISHED" },
      },
      _count: { _all: true },
    }),
    prisma.buildUsageEvent.groupBy({
      by: ["buildId"],
      where: {
        createdAt: { gte: since },
        eventType: { in: ["VIEW", "COPY"] },
        build: { teamId, status: "PUBLISHED" },
      },
      _count: { _all: true },
    }),
  ]);

  const combined: ScoredRow[] = [
    ...promptRows.map((r) => ({
      key: weekTopAssetKey("prompt", r.promptId),
      count: BigInt(r._count._all),
    })),
    ...skillRows.map((r) => ({
      key: weekTopAssetKey("skill", r.skillId),
      count: BigInt(r._count._all),
    })),
    ...contextRows.map((r) => ({
      key: weekTopAssetKey("context", r.contextId),
      count: BigInt(r._count._all),
    })),
    ...buildRows.map((r) => ({
      key: weekTopAssetKey("build", r.buildId),
      count: BigInt(r._count._all),
    })),
  ];

  combined.sort((a, b) => (a.count > b.count ? -1 : a.count < b.count ? 1 : a.key.localeCompare(b.key)));
  const top = combined.slice(0, WEEK_TOP_ASSET_LIMIT);
  return new Set(top.map((r) => r.key));
}
