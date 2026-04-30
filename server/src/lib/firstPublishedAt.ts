import type { PromptStatus } from "@prisma/client";

/** When transitioning to PUBLISHED for the first time, set `publishedAt` (immutable thereafter). */
export function firstPublishedAtOnTransition(
  existingStatus: PromptStatus,
  existingPublishedAt: Date | null,
  nextStatus: PromptStatus | undefined,
): { publishedAt: Date } | Record<string, never> {
  if (existingPublishedAt != null) {
    return {};
  }
  const resolvedNext = nextStatus !== undefined ? nextStatus : existingStatus;
  if (resolvedNext === "PUBLISHED" && existingStatus !== "PUBLISHED") {
    return { publishedAt: new Date() };
  }
  return {};
}
