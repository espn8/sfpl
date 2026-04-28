/**
 * MUST stay in sync with client/src/constants/ous.ts:
 * - CANONICAL_DEPARTMENT_OU_VALUES ↔ OU_OPTIONS
 * - LEGACY_GEO_OU_VALUES ↔ LEGACY_GEO_OU_VALUES
 */

export const CANONICAL_DEPARTMENT_OU_VALUES = [
  "Business Technology",
  "Communications",
  "Corporate Development",
  "CSG",
  "Employee Success (HR)",
  "Engineering",
  "Finance",
  "Legal",
  "Marketing",
  "Operations",
  "Product",
  "REWS",
  "Security",
  "Strategy",
] as const;

export const LEGACY_GEO_OU_VALUES = [
  "AMER TMT & CBS",
  "AMER REG",
  "AMER PACE & AFD360 OU",
  "Global SMB (incl. EBOU)",
  "UKI (incl. PE)",
  "EMEA Central",
  "EMEA North",
  "EMEA South",
  "France",
  "LATAM",
  "ANZ",
  "North Asia",
  "South Asia",
  "GPS .Org",
  "Data Foundation",
] as const;

const CANONICAL_SET = new Set<string>(CANONICAL_DEPARTMENT_OU_VALUES);

export function isCanonicalDepartmentOu(value: string): boolean {
  return CANONICAL_SET.has(value);
}
