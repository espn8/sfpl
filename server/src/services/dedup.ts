import crypto from "crypto";
import { prisma } from "../lib/prisma";

// ============ CONFIGURATION ============

export const TITLE_SIMILARITY_THRESHOLD = 0.85;
const MAX_CANDIDATES_TO_CHECK = 500;
const MAX_DUPLICATES_TO_RETURN = 10;

// ============ NORMALIZATION ============

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeBody(body: string): string {
  return body
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function computeBodyHash(body: string): string {
  const normalized = normalizeBody(body);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

// ============ FUZZY MATCHING ============

export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function titleSimilarity(a: string, b: string): number {
  const normA = normalizeTitle(a);
  const normB = normalizeTitle(b);
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(normA, normB);
  return 1 - distance / maxLen;
}

// ============ DUPLICATE DETECTION TYPES ============

export type DuplicateMatchType = "exact_title" | "similar_title" | "exact_body" | "exact_url";

export interface DuplicateMatch {
  id: number;
  title: string;
  type: DuplicateMatchType;
  similarity: number;
  ownerId: number;
  ownerName: string | null;
}

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  matches: DuplicateMatch[];
}

// ============ PROMPT DUPLICATE DETECTION ============

export async function checkPromptDuplicates(
  title: string,
  body: string,
  excludeId?: number
): Promise<DuplicateCheckResult> {
  const matches: DuplicateMatch[] = [];
  const normalizedTitle = normalizeTitle(title);
  const bodyHash = computeBodyHash(body);

  const excludeCondition = excludeId ? { id: { not: excludeId } } : {};

  // 1. Check exact body hash match (most definitive duplicate)
  const exactBodyMatch = await prisma.prompt.findFirst({
    where: {
      bodyHash,
      status: { not: "ARCHIVED" },
      ...excludeCondition,
    },
    select: {
      id: true,
      title: true,
      ownerId: true,
      owner: { select: { name: true } },
    },
  });

  if (exactBodyMatch) {
    matches.push({
      id: exactBodyMatch.id,
      title: exactBodyMatch.title,
      type: "exact_body",
      similarity: 1,
      ownerId: exactBodyMatch.ownerId,
      ownerName: exactBodyMatch.owner.name,
    });
  }

  // 2. Check title similarity (fuzzy matching)
  const titleCandidates = await prisma.prompt.findMany({
    where: {
      status: { not: "ARCHIVED" },
      ...excludeCondition,
    },
    select: {
      id: true,
      title: true,
      titleNormalized: true,
      ownerId: true,
      owner: { select: { name: true } },
    },
    take: MAX_CANDIDATES_TO_CHECK,
  });

  for (const candidate of titleCandidates) {
    if (matches.some((m) => m.id === candidate.id)) {
      continue;
    }

    const candidateNormalized = candidate.titleNormalized || normalizeTitle(candidate.title);

    if (candidateNormalized === normalizedTitle) {
      matches.push({
        id: candidate.id,
        title: candidate.title,
        type: "exact_title",
        similarity: 1,
        ownerId: candidate.ownerId,
        ownerName: candidate.owner.name,
      });
    } else {
      const similarity = titleSimilarity(title, candidate.title);
      if (similarity >= TITLE_SIMILARITY_THRESHOLD) {
        matches.push({
          id: candidate.id,
          title: candidate.title,
          type: "similar_title",
          similarity,
          ownerId: candidate.ownerId,
          ownerName: candidate.owner.name,
        });
      }
    }
  }

  matches.sort((a, b) => b.similarity - a.similarity);

  return {
    hasDuplicate: matches.length > 0,
    matches: matches.slice(0, MAX_DUPLICATES_TO_RETURN),
  };
}

// ============ SKILL DUPLICATE DETECTION ============

export async function checkSkillDuplicates(
  title: string,
  skillUrl: string,
  excludeId?: number
): Promise<DuplicateCheckResult> {
  const matches: DuplicateMatch[] = [];
  const normalizedUrl = normalizeUrl(skillUrl);

  const excludeCondition = excludeId ? { id: { not: excludeId } } : {};

  // 1. Check exact URL match
  const exactUrlMatch = await prisma.skill.findFirst({
    where: {
      skillUrlNormalized: normalizedUrl,
      status: { not: "ARCHIVED" },
      ...excludeCondition,
    },
    select: {
      id: true,
      title: true,
      ownerId: true,
      owner: { select: { name: true } },
    },
  });

  if (exactUrlMatch) {
    matches.push({
      id: exactUrlMatch.id,
      title: exactUrlMatch.title,
      type: "exact_url",
      similarity: 1,
      ownerId: exactUrlMatch.ownerId,
      ownerName: exactUrlMatch.owner.name,
    });
  }

  // 2. Check title similarity
  const titleCandidates = await prisma.skill.findMany({
    where: {
      status: { not: "ARCHIVED" },
      ...excludeCondition,
    },
    select: {
      id: true,
      title: true,
      ownerId: true,
      owner: { select: { name: true } },
    },
    take: MAX_CANDIDATES_TO_CHECK,
  });

  for (const candidate of titleCandidates) {
    if (matches.some((m) => m.id === candidate.id)) {
      continue;
    }

    const similarity = titleSimilarity(title, candidate.title);
    if (similarity >= TITLE_SIMILARITY_THRESHOLD) {
      matches.push({
        id: candidate.id,
        title: candidate.title,
        type: similarity === 1 ? "exact_title" : "similar_title",
        similarity,
        ownerId: candidate.ownerId,
        ownerName: candidate.owner.name,
      });
    }
  }

  matches.sort((a, b) => b.similarity - a.similarity);

  return {
    hasDuplicate: matches.length > 0,
    matches: matches.slice(0, MAX_DUPLICATES_TO_RETURN),
  };
}

// ============ CONTEXT DOCUMENT DUPLICATE DETECTION ============

export async function checkContextDuplicates(
  title: string,
  body: string,
  excludeId?: number
): Promise<DuplicateCheckResult> {
  const matches: DuplicateMatch[] = [];
  const normalizedTitle = normalizeTitle(title);
  const bodyHash = computeBodyHash(body);

  const excludeCondition = excludeId ? { id: { not: excludeId } } : {};

  // 1. Check exact body hash match
  const exactBodyMatch = await prisma.contextDocument.findFirst({
    where: {
      bodyHash,
      status: { not: "ARCHIVED" },
      ...excludeCondition,
    },
    select: {
      id: true,
      title: true,
      ownerId: true,
      owner: { select: { name: true } },
    },
  });

  if (exactBodyMatch) {
    matches.push({
      id: exactBodyMatch.id,
      title: exactBodyMatch.title,
      type: "exact_body",
      similarity: 1,
      ownerId: exactBodyMatch.ownerId,
      ownerName: exactBodyMatch.owner.name,
    });
  }

  // 2. Check title similarity
  const titleCandidates = await prisma.contextDocument.findMany({
    where: {
      status: { not: "ARCHIVED" },
      ...excludeCondition,
    },
    select: {
      id: true,
      title: true,
      titleNormalized: true,
      ownerId: true,
      owner: { select: { name: true } },
    },
    take: MAX_CANDIDATES_TO_CHECK,
  });

  for (const candidate of titleCandidates) {
    if (matches.some((m) => m.id === candidate.id)) {
      continue;
    }

    const candidateNormalized = candidate.titleNormalized || normalizeTitle(candidate.title);

    if (candidateNormalized === normalizedTitle) {
      matches.push({
        id: candidate.id,
        title: candidate.title,
        type: "exact_title",
        similarity: 1,
        ownerId: candidate.ownerId,
        ownerName: candidate.owner.name,
      });
    } else {
      const similarity = titleSimilarity(title, candidate.title);
      if (similarity >= TITLE_SIMILARITY_THRESHOLD) {
        matches.push({
          id: candidate.id,
          title: candidate.title,
          type: "similar_title",
          similarity,
          ownerId: candidate.ownerId,
          ownerName: candidate.owner.name,
        });
      }
    }
  }

  matches.sort((a, b) => b.similarity - a.similarity);

  return {
    hasDuplicate: matches.length > 0,
    matches: matches.slice(0, MAX_DUPLICATES_TO_RETURN),
  };
}

// ============ BUILD DUPLICATE DETECTION ============

export async function checkBuildDuplicates(
  title: string,
  buildUrl: string,
  excludeId?: number
): Promise<DuplicateCheckResult> {
  const matches: DuplicateMatch[] = [];
  const normalizedUrl = normalizeUrl(buildUrl);

  const excludeCondition = excludeId ? { id: { not: excludeId } } : {};

  // 1. Check exact URL match
  const exactUrlMatch = await prisma.build.findFirst({
    where: {
      buildUrlNormalized: normalizedUrl,
      status: { not: "ARCHIVED" },
      ...excludeCondition,
    },
    select: {
      id: true,
      title: true,
      ownerId: true,
      owner: { select: { name: true } },
    },
  });

  if (exactUrlMatch) {
    matches.push({
      id: exactUrlMatch.id,
      title: exactUrlMatch.title,
      type: "exact_url",
      similarity: 1,
      ownerId: exactUrlMatch.ownerId,
      ownerName: exactUrlMatch.owner.name,
    });
  }

  // 2. Check title similarity
  const titleCandidates = await prisma.build.findMany({
    where: {
      status: { not: "ARCHIVED" },
      ...excludeCondition,
    },
    select: {
      id: true,
      title: true,
      ownerId: true,
      owner: { select: { name: true } },
    },
    take: MAX_CANDIDATES_TO_CHECK,
  });

  for (const candidate of titleCandidates) {
    if (matches.some((m) => m.id === candidate.id)) {
      continue;
    }

    const similarity = titleSimilarity(title, candidate.title);
    if (similarity >= TITLE_SIMILARITY_THRESHOLD) {
      matches.push({
        id: candidate.id,
        title: candidate.title,
        type: similarity === 1 ? "exact_title" : "similar_title",
        similarity,
        ownerId: candidate.ownerId,
        ownerName: candidate.owner.name,
      });
    }
  }

  matches.sort((a, b) => b.similarity - a.similarity);

  return {
    hasDuplicate: matches.length > 0,
    matches: matches.slice(0, MAX_DUPLICATES_TO_RETURN),
  };
}

// ============ UTILITY: FORMAT DUPLICATE ERROR ============

export function formatDuplicateError(result: DuplicateCheckResult) {
  return {
    error: {
      code: "DUPLICATE_DETECTED",
      message: "A similar asset already exists.",
      duplicates: result.matches,
    },
  };
}
