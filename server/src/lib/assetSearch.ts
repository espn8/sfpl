import type { Prisma } from "@prisma/client";

/**
 * Prisma `OR` fragment: match asset owner display name (substring, case-insensitive).
 * Use alongside title/summary/body conditions when applying free-text `q`.
 */
export function ownerNameSearchClause(q: string) {
  return { owner: { name: { contains: q, mode: "insensitive" as const } } };
}

/**
 * Normalized whitespace-separated tokens for catalog search.
 * Multi-token queries use AND across tokens so titles with irregular spacing
 * (e.g. "Keep  My  Job") still match "keep my job".
 */
export function splitSearchTokens(q: string): string[] {
  return q.trim().split(/\s+/).filter((t) => t.length > 0);
}

function promptTokenMatch(token: string): Prisma.PromptWhereInput {
  return {
    OR: [
      { title: { contains: token, mode: "insensitive" } },
      { summary: { contains: token, mode: "insensitive" } },
      { body: { contains: token, mode: "insensitive" } },
      ownerNameSearchClause(token),
    ],
  };
}

/** Title/summary/body/owner — each token must match at least one field (OR), tokens are ANDed. */
export function promptFreeTextWhere(q: string): Prisma.PromptWhereInput | undefined {
  const tokens = splitSearchTokens(q);
  if (tokens.length === 0) return undefined;
  if (tokens.length === 1) return promptTokenMatch(tokens[0]!);
  return { AND: tokens.map(promptTokenMatch) };
}

function skillTokenMatch(token: string): Prisma.SkillWhereInput {
  const normalized = token.trim().toLowerCase();
  return {
    OR: [
      { title: { contains: token, mode: "insensitive" } },
      { summary: { contains: token, mode: "insensitive" } },
      { skillUrl: { contains: token, mode: "insensitive" } },
      { skillUrlNormalized: { contains: normalized, mode: "insensitive" } },
      ownerNameSearchClause(token),
    ],
  };
}

export function skillFreeTextWhere(q: string): Prisma.SkillWhereInput | undefined {
  const tokens = splitSearchTokens(q);
  if (tokens.length === 0) return undefined;
  if (tokens.length === 1) return skillTokenMatch(tokens[0]!);
  return { AND: tokens.map(skillTokenMatch) };
}

function contextTokenMatch(token: string): Prisma.ContextDocumentWhereInput {
  return {
    OR: [
      { title: { contains: token, mode: "insensitive" } },
      { summary: { contains: token, mode: "insensitive" } },
      { body: { contains: token, mode: "insensitive" } },
      ownerNameSearchClause(token),
    ],
  };
}

export function contextFreeTextWhere(q: string): Prisma.ContextDocumentWhereInput | undefined {
  const tokens = splitSearchTokens(q);
  if (tokens.length === 0) return undefined;
  if (tokens.length === 1) return contextTokenMatch(tokens[0]!);
  return { AND: tokens.map(contextTokenMatch) };
}

function catalogBuildTokenMatch(token: string): Prisma.BuildWhereInput {
  return {
    OR: [
      { title: { contains: token, mode: "insensitive" } },
      { summary: { contains: token, mode: "insensitive" } },
      ownerNameSearchClause(token),
    ],
  };
}

/** Free-text match for Build listings (title/summary/owner). */
export function catalogBuildFreeTextWhere(q: string): Prisma.BuildWhereInput | undefined {
  const tokens = splitSearchTokens(q);
  if (tokens.length === 0) return undefined;
  if (tokens.length === 1) return catalogBuildTokenMatch(tokens[0]!);
  return { AND: tokens.map(catalogBuildTokenMatch) };
}
