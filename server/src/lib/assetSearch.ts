/**
 * Prisma `OR` fragment: match asset owner display name (substring, case-insensitive).
 * Use alongside title/summary/body conditions when applying free-text `q`.
 */
export function ownerNameSearchClause(q: string) {
  return { owner: { name: { contains: q, mode: "insensitive" as const } } };
}
