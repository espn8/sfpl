import { useEffect, useRef } from "react";
import { getServerTiming, isPerfEnabled, mark, measureSince, sinceNavigationStart } from "../../lib/perf";

type HomePerfMarksInput = {
  meReady: boolean;
  assetsReady: boolean;
  topReady: boolean;
  leaderboardsReady: boolean;
  leaderboardsEnabled: boolean;
};

const MOUNT_MARK = "home:mount";

/**
 * Opt-in homepage timing. Marks key transitions and, once all expected queries
 * have resolved, logs a single console.table combining client wall-clock with
 * the Server-Timing breakdown from /api/assets.
 *
 * Enable with `localStorage.setItem("perf", "1")` and reload.
 */
export function useHomePerfMarks({
  meReady,
  assetsReady,
  topReady,
  leaderboardsReady,
  leaderboardsEnabled,
}: HomePerfMarksInput): void {
  const mountedRef = useRef(false);
  const meMarkedRef = useRef(false);
  const assetsMarkedRef = useRef(false);
  const topMarkedRef = useRef(false);
  const leaderboardsMarkedRef = useRef(false);
  const reportedRef = useRef(false);

  if (!mountedRef.current) {
    mountedRef.current = true;
    mark(MOUNT_MARK);
  }

  useEffect(() => {
    if (meReady && !meMarkedRef.current) {
      meMarkedRef.current = true;
      mark("home:me-resolved");
    }
  }, [meReady]);

  useEffect(() => {
    if (assetsReady && !assetsMarkedRef.current) {
      assetsMarkedRef.current = true;
      mark("home:assets-resolved");
    }
  }, [assetsReady]);

  useEffect(() => {
    if (topReady && !topMarkedRef.current) {
      topMarkedRef.current = true;
      mark("home:top-resolved");
    }
  }, [topReady]);

  useEffect(() => {
    if (leaderboardsReady && !leaderboardsMarkedRef.current) {
      leaderboardsMarkedRef.current = true;
      mark("home:leaderboards-resolved");
    }
  }, [leaderboardsReady]);

  useEffect(() => {
    if (!isPerfEnabled() || reportedRef.current) return;
    if (!assetsReady || !topReady) return;
    if (leaderboardsEnabled && !leaderboardsReady) return;

    reportedRef.current = true;

    const runReport = () => {
      mark("home:interactive");

      const rows: Array<Record<string, string | number>> = [];
      const record = (name: string, sinceMount: number | undefined, sinceNav?: number | undefined) => {
        rows.push({
          event: name,
          "sinceMount(ms)": sinceMount !== undefined ? Number(sinceMount.toFixed(1)) : "-",
          "sinceNav(ms)": sinceNav !== undefined ? Number(sinceNav.toFixed(1)) : "-",
        });
      };

      const navNow = sinceNavigationStart();
      record("home:mount", 0, navNow !== undefined ? navNow - (measureSince("home:mount", MOUNT_MARK) ?? 0) : undefined);
      record("home:me-resolved", measureSince("home:me-resolved", MOUNT_MARK));
      record("home:assets-resolved", measureSince("home:assets-resolved", MOUNT_MARK));
      record("home:top-resolved", measureSince("home:top-resolved", MOUNT_MARK));
      if (leaderboardsEnabled) {
        record("home:leaderboards-resolved", measureSince("home:leaderboards-resolved", MOUNT_MARK));
      }
      record("home:interactive", measureSince("home:interactive", MOUNT_MARK));

      // eslint-disable-next-line no-console
      console.groupCollapsed("[perf] homepage timing");
      // eslint-disable-next-line no-console
      console.table(rows);

      const serverTiming = getServerTiming("/api/assets");
      if (serverTiming && serverTiming.length > 0) {
        // eslint-disable-next-line no-console
        console.log("[perf] /api/assets Server-Timing");
        // eslint-disable-next-line no-console
        console.table(
          serverTiming.map((e) => ({
            section: e.name,
            "dur(ms)": Number(e.dur.toFixed(1)),
            desc: e.desc ?? "",
          })),
        );
      } else {
        // eslint-disable-next-line no-console
        console.log("[perf] no Server-Timing header captured - is PERF_LOG=1 set on the server?");
      }
      // eslint-disable-next-line no-console
      console.groupEnd();
    };

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(runReport, { timeout: 500 });
    } else {
      window.setTimeout(runReport, 0);
    }
  }, [assetsReady, topReady, leaderboardsReady, leaderboardsEnabled]);
}
