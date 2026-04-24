export const SUMMARY_MAX_CHARS = 200;

export const SUMMARY_TOO_LONG_MESSAGE = `Summary must be ${SUMMARY_MAX_CHARS} characters or fewer.`;

export type SummaryLengthCheck =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Allows a new summary to exceed SUMMARY_MAX_CHARS only when it equals the
 * previously stored value (grandfathering). This lets users save unrelated
 * edits to a record with a legacy long summary without being forced to shorten
 * the summary first. A changed over-limit value is always rejected.
 */
export function checkUpdatedSummaryLength(
  next: string | null | undefined,
  previous: string | null | undefined,
): SummaryLengthCheck {
  if (typeof next !== "string") {
    return { ok: true };
  }
  if (next.length <= SUMMARY_MAX_CHARS) {
    return { ok: true };
  }
  if (typeof previous === "string" && next === previous) {
    return { ok: true };
  }
  return { ok: false, message: SUMMARY_TOO_LONG_MESSAGE };
}
