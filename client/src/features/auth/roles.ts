import type { AuthUser } from "./api";

/** Roles that may access admin-only UI (analytics, team settings). */
export function canAccessAdminUi(role: AuthUser["role"] | undefined): boolean {
  return role === "ADMIN" || role === "OWNER";
}
