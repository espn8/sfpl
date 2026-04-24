export const SUMMARY_MAX_CHARS = 200;

export const SUMMARY_WARN_CHARS = 160;

export const SUMMARY_PLACEHOLDER = "One sentence — why would someone use this? (Max 200 characters)";

export const SUMMARY_HELPER_TEXT = "Max 200 characters";

export type SummaryLengthState = "ok" | "warn" | "over";

export function getSummaryLengthState(length: number): SummaryLengthState {
  if (length > SUMMARY_MAX_CHARS) {
    return "over";
  }
  if (length >= SUMMARY_WARN_CHARS) {
    return "warn";
  }
  return "ok";
}
