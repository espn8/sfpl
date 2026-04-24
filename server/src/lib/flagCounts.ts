/**
 * Tiny helper that turns a list of rating rows into a map of FeedbackFlag ->
 * count. Used by the asset list/detail endpoints to surface how often each
 * flag was applied (e.g. "12 people said this didn't work").
 *
 * Safe to call with an empty array.
 */

export type FlagCountMap = Record<string, number>;

export function countFlags(ratings: Array<{ feedbackFlags?: string[] | null }>): FlagCountMap {
  const counts: FlagCountMap = {};
  for (const r of ratings) {
    const flags = r.feedbackFlags ?? [];
    for (const flag of flags) {
      counts[flag] = (counts[flag] ?? 0) + 1;
    }
  }
  return counts;
}
