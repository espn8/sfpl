import type { Prisma } from "@prisma/client";

/**
 * Team catalog surfaces (lists, search, collection member previews, deep links):
 * viewers only see others' published assets; owners always see their own regardless of status.
 */
export function canViewAssetInTeamCatalog(status: string, ownerId: number, viewerUserId: number): boolean {
  return status === "PUBLISHED" || ownerId === viewerUserId;
}

/** Prisma fragment for nested collection membership rows (hide others' drafts/archived). */
export function catalogVisiblePromptWhere(viewerUserId: number): Prisma.PromptWhereInput {
  return { OR: [{ status: "PUBLISHED" }, { ownerId: viewerUserId }] };
}

export function catalogVisibleSkillWhere(viewerUserId: number): Prisma.SkillWhereInput {
  return { OR: [{ status: "PUBLISHED" }, { ownerId: viewerUserId }] };
}

export function catalogVisibleContextWhere(viewerUserId: number): Prisma.ContextDocumentWhereInput {
  return { OR: [{ status: "PUBLISHED" }, { ownerId: viewerUserId }] };
}

export function catalogVisibleBuildWhere(viewerUserId: number): Prisma.BuildWhereInput {
  return { OR: [{ status: "PUBLISHED" }, { ownerId: viewerUserId }] };
}
