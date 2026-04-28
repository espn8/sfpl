/**
 * Canonical Department/OU values for the profile dropdown (plain names; no " - Sales").
 * Must stay in sync with server/src/constants/departmentOuOptions.ts (CANONICAL_DEPARTMENT_OU_VALUES).
 */
export const OU_OPTIONS = [
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

/** Geographic OUs from the pre–Department/OU taxonomy; used for legacy ` - Sales` data migration only. */
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

export type OuOption = (typeof OU_OPTIONS)[number];

const CANONICAL_SET = new Set<string>(OU_OPTIONS);

export function isCanonicalDepartmentOu(value: string): boolean {
  return CANONICAL_SET.has(value);
}

export const DEPARTMENT_OU_OTHER_SENTINEL = "__OTHER__" as const;

/** Value for `User.ou` from select + optional custom text when Other is chosen (server trims on save). */
export function departmentOuSubmitValue(select: string, custom: string): string {
  if (select === DEPARTMENT_OU_OTHER_SENTINEL) {
    return custom;
  }
  return select;
}
