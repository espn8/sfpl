import type { AuthContext } from "../middleware/auth";

export function isAdminOrOwner(role: string): boolean {
  return role === "ADMIN" || role === "OWNER";
}

type VisibilityOrCondition = {
  visibility?: "PUBLIC" | "TEAM" | "PRIVATE";
  ownerId?: number;
  teamId?: number;
  owner?: { ou: string | null };
};

type VisibilityWhereFragment = {
  OR?: VisibilityOrCondition[];
};

/**
 * Returns a where fragment that encodes the visibility-based read access rules.
 *
 * - Admin / Owner role: returns `{}` (unrestricted; cross-tenant read).
 * - Anyone else: returns an `OR` set matching
 *     - any PUBLIC asset (globally, cross-tenant),
 *     - any asset owned by the viewer,
 *     - TEAM assets in the viewer's tenant whose owner shares the viewer's OU.
 *
 * The fragment is shaped to be merged into a list query under `AND` so it
 * cannot be accidentally overwritten by another `OR` on the same query.
 */
export function buildVisibilityWhereFragment(auth: AuthContext): VisibilityWhereFragment {
  if (isAdminOrOwner(auth.role)) {
    return {};
  }

  const conditions: VisibilityOrCondition[] = [
    { visibility: "PUBLIC" },
    { ownerId: auth.userId },
  ];

  if (auth.userOu) {
    conditions.push({
      visibility: "TEAM",
      teamId: auth.teamId,
      owner: { ou: auth.userOu },
    });
  }

  return { OR: conditions };
}

type AccessibleAsset = {
  teamId: number;
  ownerId: number;
  visibility: string;
  owner?: { ou: string | null } | null;
};

/**
 * Per-item access check used by detail / interaction endpoints.
 *
 * Mirrors the same rules as `buildVisibilityWhereFragment` but for a single
 * already-loaded record. Callers that look up an asset by id alone should use
 * this to authorize the response.
 */
export function canAccessByVisibility(asset: AccessibleAsset, auth: AuthContext): boolean {
  if (isAdminOrOwner(auth.role)) {
    return true;
  }
  if (asset.visibility === "PUBLIC") {
    return true;
  }
  if (asset.ownerId === auth.userId) {
    return true;
  }
  if (
    asset.visibility === "TEAM" &&
    asset.teamId === auth.teamId &&
    auth.userOu !== null &&
    auth.userOu !== "" &&
    asset.owner?.ou === auth.userOu
  ) {
    return true;
  }
  return false;
}

/**
 * Who may change an asset's content, status, or metadata (except routes that intentionally
 * restrict to asset owner only, e.g. permanent delete):
 * - The asset owner, even when their session `teamId` no longer matches the row (e.g. user
 *   moved workspaces but the asset row was not backfilled).
 * - Workspace `ADMIN` / `OWNER` role for assets that belong to their current team.
 */
export function canMutateTeamScopedAsset(asset: { ownerId: number; teamId: number }, auth: AuthContext): boolean {
  if (asset.ownerId === auth.userId) {
    return true;
  }
  if (auth.role === "OWNER" || auth.role === "ADMIN") {
    return asset.teamId === auth.teamId;
  }
  return false;
}
