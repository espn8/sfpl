import { describe, expect, it } from "vitest";
import {
  buildAggregate,
  computeBayesianScore,
  computeFinalScore,
  countFlags,
  didNotWorkRate,
  DEFAULT_GLOBAL_MEAN,
} from "../src/services/scoring";

type FlagList = ("WORKED_WELL" | "DID_NOT_WORK" | "INACCURATE" | "OUTDATED" | "OFF_TOPIC")[];

function ratings(values: Array<{ v: number; flags?: FlagList }>) {
  return values.map((x) => ({ value: x.v, feedbackFlags: x.flags ?? [] }));
}

describe("scoring utilities", () => {
  it("countFlags tallies occurrences across ratings", () => {
    const r = ratings([
      { v: 5, flags: ["WORKED_WELL"] },
      { v: 3, flags: ["DID_NOT_WORK", "INACCURATE"] },
      { v: 4, flags: ["WORKED_WELL", "WORKED_WELL"] },
    ]);
    expect(countFlags(r)).toEqual({ WORKED_WELL: 3, DID_NOT_WORK: 1, INACCURATE: 1 });
  });

  it("didNotWorkRate returns 0 when no ratings", () => {
    expect(didNotWorkRate([])).toBe(0);
  });

  it("didNotWorkRate computes the fraction with DID_NOT_WORK flag", () => {
    const r = ratings([
      { v: 5 },
      { v: 1, flags: ["DID_NOT_WORK"] },
      { v: 2, flags: ["DID_NOT_WORK"] },
      { v: 4 },
    ]);
    expect(didNotWorkRate(r)).toBeCloseTo(0.5);
  });

  it("computeBayesianScore returns the global mean when no ratings", () => {
    const agg = buildAggregate(ratings([]));
    expect(computeBayesianScore(agg, DEFAULT_GLOBAL_MEAN)).toBe(DEFAULT_GLOBAL_MEAN);
  });

  it("computeBayesianScore smooths a single 5-star rating toward the prior", () => {
    const agg = buildAggregate(ratings([{ v: 5 }]));
    const score = computeBayesianScore(agg, 3.5);
    expect(score).toBeGreaterThan(3.5);
    expect(score).toBeLessThan(5);
  });

  it("computeBayesianScore converges toward the raw average as count grows", () => {
    const many = ratings(Array.from({ length: 50 }, () => ({ v: 5 })));
    const agg = buildAggregate(many);
    const score = computeBayesianScore(agg, 3);
    expect(score).toBeGreaterThan(4.8);
  });

  it("computeFinalScore penalizes DID_NOT_WORK rate more than INACCURATE/OUTDATED", () => {
    const baselineAgg = buildAggregate(ratings([{ v: 4 }, { v: 4 }, { v: 4 }, { v: 4 }, { v: 4 }]));
    const didNotWorkAgg = buildAggregate(
      ratings([
        { v: 4 },
        { v: 4 },
        { v: 4, flags: ["DID_NOT_WORK"] },
        { v: 4, flags: ["DID_NOT_WORK"] },
        { v: 4 },
      ]),
    );
    const inaccurateAgg = buildAggregate(
      ratings([
        { v: 4 },
        { v: 4 },
        { v: 4, flags: ["INACCURATE"] },
        { v: 4, flags: ["INACCURATE"] },
        { v: 4 },
      ]),
    );
    const base = computeFinalScore(baselineAgg, 3.5);
    const didNot = computeFinalScore(didNotWorkAgg, 3.5);
    const inaccurate = computeFinalScore(inaccurateAgg, 3.5);
    expect(didNot).toBeLessThan(inaccurate);
    expect(inaccurate).toBeLessThan(base);
  });

  it("computeFinalScore rewards WORKED_WELL rate", () => {
    const baselineAgg = buildAggregate(ratings([{ v: 4 }, { v: 4 }, { v: 4 }, { v: 4 }, { v: 4 }]));
    const workedWellAgg = buildAggregate(
      ratings([
        { v: 4, flags: ["WORKED_WELL"] },
        { v: 4, flags: ["WORKED_WELL"] },
        { v: 4 },
        { v: 4 },
        { v: 4 },
      ]),
    );
    const base = computeFinalScore(baselineAgg, 3.5);
    const worked = computeFinalScore(workedWellAgg, 3.5);
    expect(worked).toBeGreaterThan(base);
  });
});
