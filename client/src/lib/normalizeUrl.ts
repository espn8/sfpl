/** Match server `normalizeUrl` in `server/src/services/dedup.ts` for duplicate / equality checks. */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}
