/**
 * Shared scoring utilities for "top rated" and Smart Pick surfaces.
 *
 * Historically the Top Rated lists used a raw average of the 1-5 star values,
 * which overweights assets with a single 5-star rating over mature ones with
 * 50+ ratings at 4.8. We now use Bayesian smoothing plus feedback-flag
 * penalties so noisy, low-count, or "flagged as broken" assets don't climb.
 *
 * `finalScore = smoothed - 0.30 * didNotWorkRate
 *             - 0.20 * inaccurateRate
 *             - 0.10 * outdatedRate
 *             + 0.10 * workedWellRate`
 *
 * where `smoothed = (v * r + m * C) / (v + m)` with `m = 5` prior and
 * `C` the global team-wide mean rating (defaulting to 3.5 when unknown).
 */

import { prisma } from "../lib/prisma";
import type { FeedbackFlag } from "@prisma/client";

export const PRIOR_WEIGHT = 5;
export const DEFAULT_GLOBAL_MEAN = 3.5;

export type RatingAggregate = {
  count: number;
  average: number;
  flagCounts: Partial<Record<FeedbackFlag, number>>;
};

/**
 * Count occurrences of each feedback flag across an array of rating rows.
 * Shared by list/detail endpoints that surface flag tallies to clients.
 */
export function countFlags(
  ratings: Array<{ feedbackFlags: FeedbackFlag[] | string[] }>,
): Partial<Record<FeedbackFlag, number>> {
  const counts: Partial<Record<FeedbackFlag, number>> = {};
  for (const r of ratings) {
    for (const flag of r.feedbackFlags as FeedbackFlag[]) {
      counts[flag] = (counts[flag] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Percentage of ratings flagged as "DID_NOT_WORK" — surfaced in UI as a
 * "didn't work" rate next to the star rating so owners can see breakage.
 */
export function didNotWorkRate(
  ratings: Array<{ feedbackFlags: FeedbackFlag[] | string[] }>,
): number {
  if (ratings.length === 0) return 0;
  const didNot = ratings.filter((r) =>
    (r.feedbackFlags as string[]).includes("DID_NOT_WORK"),
  ).length;
  return didNot / ratings.length;
}

export function computeBayesianScore(agg: RatingAggregate, globalMean: number): number {
  const v = agg.count;
  const r = agg.average;
  if (v === 0) return globalMean;
  return (v * r + PRIOR_WEIGHT * globalMean) / (v + PRIOR_WEIGHT);
}

export function computeFinalScore(agg: RatingAggregate, globalMean: number): number {
  const smoothed = computeBayesianScore(agg, globalMean);
  const total = agg.count || 1;
  const rate = (flag: FeedbackFlag) => (agg.flagCounts[flag] ?? 0) / total;
  return (
    smoothed -
    0.3 * rate("DID_NOT_WORK") -
    0.2 * rate("INACCURATE") -
    0.1 * rate("OUTDATED") +
    0.1 * rate("WORKED_WELL")
  );
}

export type AssetKind = "PROMPT" | "SKILL" | "CONTEXT" | "BUILD";

/**
 * Compute the top N asset IDs of a given kind by `finalScore`, restricted to
 * PUBLISHED assets whose verification hasn't expired. Used by the governance
 * job to recompute `isSmartPick` and by analytics endpoints for "top rated".
 */
export async function computeTopScored(kind: AssetKind, n: number, now: Date): Promise<number[]> {
  switch (kind) {
    case "PROMPT":
      return computeTopScoredPrompts(n, now);
    case "SKILL":
      return computeTopScoredSkills(n, now);
    case "CONTEXT":
      return computeTopScoredContexts(n, now);
    case "BUILD":
      return computeTopScoredBuilds(n, now);
  }
}

async function eligiblePromptIds(now: Date): Promise<number[]> {
  const rows = await prisma.prompt.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ verificationDueAt: null }, { verificationDueAt: { gt: now } }],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function eligibleSkillIds(now: Date): Promise<number[]> {
  const rows = await prisma.skill.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ verificationDueAt: null }, { verificationDueAt: { gt: now } }],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function eligibleContextIds(now: Date): Promise<number[]> {
  const rows = await prisma.contextDocument.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ verificationDueAt: null }, { verificationDueAt: { gt: now } }],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function eligibleBuildIds(now: Date): Promise<number[]> {
  const rows = await prisma.build.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ verificationDueAt: null }, { verificationDueAt: { gt: now } }],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function computeTopScoredPrompts(n: number, now: Date): Promise<number[]> {
  const ids = await eligiblePromptIds(now);
  if (ids.length === 0) return [];
  const ratings = await prisma.rating.findMany({
    where: { promptId: { in: ids } },
    select: { promptId: true, value: true, feedbackFlags: true },
  });
  return topByScore(
    ids,
    ratings.map((r) => ({ assetId: r.promptId, value: r.value, feedbackFlags: r.feedbackFlags })),
    n,
  );
}

async function computeTopScoredSkills(n: number, now: Date): Promise<number[]> {
  const ids = await eligibleSkillIds(now);
  if (ids.length === 0) return [];
  const ratings = await prisma.skillRating.findMany({
    where: { skillId: { in: ids } },
    select: { skillId: true, value: true, feedbackFlags: true },
  });
  return topByScore(
    ids,
    ratings.map((r) => ({ assetId: r.skillId, value: r.value, feedbackFlags: r.feedbackFlags })),
    n,
  );
}

async function computeTopScoredContexts(n: number, now: Date): Promise<number[]> {
  const ids = await eligibleContextIds(now);
  if (ids.length === 0) return [];
  const ratings = await prisma.contextRating.findMany({
    where: { contextId: { in: ids } },
    select: { contextId: true, value: true, feedbackFlags: true },
  });
  return topByScore(
    ids,
    ratings.map((r) => ({ assetId: r.contextId, value: r.value, feedbackFlags: r.feedbackFlags })),
    n,
  );
}

async function computeTopScoredBuilds(n: number, now: Date): Promise<number[]> {
  const ids = await eligibleBuildIds(now);
  if (ids.length === 0) return [];
  const ratings = await prisma.buildRating.findMany({
    where: { buildId: { in: ids } },
    select: { buildId: true, value: true, feedbackFlags: true },
  });
  return topByScore(
    ids,
    ratings.map((r) => ({ assetId: r.buildId, value: r.value, feedbackFlags: r.feedbackFlags })),
    n,
  );
}

type RatingRow = { assetId: number; value: number; feedbackFlags: FeedbackFlag[] };

function topByScore(allIds: number[], ratings: RatingRow[], n: number): number[] {
  const globalMean = ratings.length === 0 ? DEFAULT_GLOBAL_MEAN : ratings.reduce((s, r) => s + r.value, 0) / ratings.length;

  const byAsset = new Map<number, { count: number; sum: number; flagCounts: Partial<Record<FeedbackFlag, number>> }>();
  for (const id of allIds) byAsset.set(id, { count: 0, sum: 0, flagCounts: {} });
  for (const r of ratings) {
    const entry = byAsset.get(r.assetId);
    if (!entry) continue;
    entry.count += 1;
    entry.sum += r.value;
    for (const flag of r.feedbackFlags) {
      entry.flagCounts[flag] = (entry.flagCounts[flag] ?? 0) + 1;
    }
  }

  const scored = Array.from(byAsset.entries()).map(([id, entry]) => {
    const agg: RatingAggregate = {
      count: entry.count,
      average: entry.count === 0 ? 0 : entry.sum / entry.count,
      flagCounts: entry.flagCounts,
    };
    return { id, score: computeFinalScore(agg, globalMean), count: entry.count };
  });

  return scored
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, n)
    .map((x) => x.id);
}

/** Aggregate rating stats for a single asset; returns count, average, and per-flag counts. */
export function buildAggregate(ratings: Array<{ value: number; feedbackFlags: FeedbackFlag[] }>): RatingAggregate {
  const count = ratings.length;
  if (count === 0) return { count: 0, average: 0, flagCounts: {} };
  let sum = 0;
  const flagCounts: Partial<Record<FeedbackFlag, number>> = {};
  for (const r of ratings) {
    sum += r.value;
    for (const flag of r.feedbackFlags) {
      flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;
    }
  }
  return { count, average: sum / count, flagCounts };
}
