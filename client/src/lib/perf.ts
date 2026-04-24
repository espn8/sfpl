/**
 * Lightweight, opt-in client-side perf instrumentation.
 *
 * Enable via `localStorage.setItem("perf", "1")` and reload.
 * When disabled, every exported function is a cheap no-op.
 */

export type ServerTimingEntry = { name: string; dur: number; desc?: string };

const serverTimingsByUrl = new Map<string, ServerTimingEntry[]>();

export function isPerfEnabled(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage?.getItem("perf") === "1";
  } catch {
    return false;
  }
}

function parseServerTimingHeader(header: string): ServerTimingEntry[] {
  const entries: ServerTimingEntry[] = [];
  for (const chunk of header.split(",")) {
    const parts = chunk.split(";").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    const name = parts[0];
    let dur = 0;
    let desc: string | undefined;
    for (const part of parts.slice(1)) {
      const [k, v] = part.split("=");
      if (!k || v === undefined) continue;
      if (k === "dur") {
        const n = Number(v);
        if (Number.isFinite(n)) dur = n;
      } else if (k === "desc") {
        desc = v.replace(/^"|"$/g, "");
      }
    }
    entries.push({ name, dur, desc });
  }
  return entries;
}

function normalizeUrlKey(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname;
  } catch {
    return url.split("?")[0];
  }
}

export function recordServerTiming(url: string, header: string | null | undefined): void {
  if (!isPerfEnabled() || !header) return;
  const entries = parseServerTimingHeader(header);
  if (entries.length === 0) return;
  serverTimingsByUrl.set(normalizeUrlKey(url), entries);
}

export function getServerTiming(url: string): ServerTimingEntry[] | undefined {
  return serverTimingsByUrl.get(normalizeUrlKey(url));
}

export function mark(name: string): void {
  if (!isPerfEnabled() || typeof performance === "undefined" || typeof performance.mark !== "function") {
    return;
  }
  try {
    performance.mark(name);
  } catch {
    // ignore duplicate-mark errors
  }
}

export function measureSince(markName: string, startMark: string): number | undefined {
  if (!isPerfEnabled() || typeof performance === "undefined") return undefined;
  try {
    const markEntries = performance.getEntriesByName(markName, "mark");
    const startEntries = performance.getEntriesByName(startMark, "mark");
    if (startEntries.length === 0) return undefined;
    const start = startEntries[0].startTime;
    const end = markEntries.length > 0 ? markEntries[0].startTime : performance.now();
    return end - start;
  } catch {
    return undefined;
  }
}

/** Milliseconds since `navigationStart` (or the given mark name if provided). */
export function sinceNavigationStart(): number | undefined {
  if (typeof performance === "undefined") return undefined;
  const [nav] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  const origin = nav ? nav.startTime : 0;
  return performance.now() - origin;
}
