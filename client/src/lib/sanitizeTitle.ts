const ASSET_TYPE_WORDS = ["prompt", "skill", "context", "rule", "document", "doc", "file"];

const ASSET_TYPE_PATTERN = new RegExp(
  `\\b(${ASSET_TYPE_WORDS.join("|")})s?\\b`,
  "gi"
);

export function sanitizeTitle(title: string): string {
  return title
    .replace(ASSET_TYPE_PATTERN, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
