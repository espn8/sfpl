import type { AuthUser } from "./api";

/** Roles that may access admin-only UI (analytics, team settings). */
export function canAccessAdminUi(role: AuthUser["role"] | undefined): boolean {
  return role === "ADMIN" || role === "OWNER";
}

/**
 * Who may permanently delete an asset in the UI (matches server `isOwnerOrWorkspaceAdmin` for `/permanent`).
 * Workspace ADMIN / OWNER: any asset. Others: only their own, and only if they may create content.
 */
export function canPermanentlyDeleteAsset(
  role: AuthUser["role"] | undefined,
  viewerUserId: number | undefined,
  assetOwnerId: number | undefined,
): boolean {
  if (canAccessAdminUi(role)) {
    return true;
  }
  return (
    typeof viewerUserId === "number" &&
    typeof assetOwnerId === "number" &&
    viewerUserId === assetOwnerId &&
    canCreateContent(role)
  );
}

/** Roles that may create, edit, or delete content. VIEWER is excluded. */
export function canCreateContent(role: AuthUser["role"] | undefined): boolean {
  return role === "ADMIN" || role === "OWNER" || role === "MEMBER";
}
