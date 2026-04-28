import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/** Canonical stored form for global tag uniqueness (matches migration merge key). */
export function normalizeTagNameForStorage(name: string): string {
  return name.trim().toLowerCase();
}

export async function validateTagIdsExist(tagIds: number[]): Promise<boolean> {
  if (tagIds.length === 0) return true;
  const unique = [...new Set(tagIds)];
  const count = await prisma.tag.count({ where: { id: { in: unique } } });
  return count === unique.length;
}

export function tagWhereByNameInsensitive(tagName: string): Prisma.TagWhereInput {
  return { name: { equals: tagName.trim(), mode: "insensitive" } };
}

export function promptTaggedWithWhere(tagName: string): Prisma.PromptWhereInput {
  return {
    promptTags: { some: { tag: tagWhereByNameInsensitive(tagName) } },
  };
}

export function skillTaggedWithWhere(tagName: string): Prisma.SkillWhereInput {
  return {
    skillTags: { some: { tag: tagWhereByNameInsensitive(tagName) } },
  };
}

export function contextTaggedWithWhere(tagName: string): Prisma.ContextDocumentWhereInput {
  return {
    contextTags: { some: { tag: tagWhereByNameInsensitive(tagName) } },
  };
}

export function buildTaggedWithWhere(tagName: string): Prisma.BuildWhereInput {
  return {
    buildTags: { some: { tag: tagWhereByNameInsensitive(tagName) } },
  };
}
