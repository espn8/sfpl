export const OU_OPTIONS = [
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
