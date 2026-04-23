import type { AuthUser } from "./api";

/** Roles that may access admin-only UI (analytics, team settings). */
export function canAccessAdminUi(role: AuthUser["role"] | undefined): boolean {
  return role === "ADMIN" || role === "OWNER";
}

/** Roles that may create, edit, or delete content. VIEWER is excluded. */
export function canCreateContent(role: AuthUser["role"] | undefined): boolean {
  return role === "ADMIN" || role === "OWNER" || role === "MEMBER";
}
