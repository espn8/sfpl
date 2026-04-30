/** Rolling 7-day window start (inclusive), aligned with week leaderboard logic. */
export function rollingSevenDaysSince(nowMs: number = Date.now()): Date {
  return new Date(nowMs - 7 * 24 * 60 * 60 * 1000);
}
