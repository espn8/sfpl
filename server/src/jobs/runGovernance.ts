/**
 * Heroku Scheduler entrypoint: runs the daily governance sweep.
 *
 * Invoke via `node server/dist/jobs/runGovernance.js` (add a scheduler entry
 * set to 08:00 UTC daily). When GOVERNANCE_SWEEP_ENABLED is false, this still
 * executes but in dry-run mode so ops can inspect the audit log before we
 * start archiving for real.
 */
import { prisma } from "../lib/prisma";
import { runGovernanceSweepWithGate } from "./governance";

async function main(): Promise<void> {
  const dryRunArg = process.argv.includes("--dry-run");
  const started = Date.now();
  console.log(
    `[governance] starting sweep (dryRun=${dryRunArg || undefined ? "forced" : "env-gated"})`,
  );

  try {
    const result = await runGovernanceSweepWithGate({ dryRun: dryRunArg });
    console.log("[governance] sweep complete", {
      elapsedMs: Date.now() - started,
      dryRun: result.dryRun,
      totals: result.totals,
      smartPicksRecomputed: result.smartPicksRecomputed,
      byAssetType: result.byAssetType,
    });
    process.exitCode = 0;
  } catch (error) {
    console.error("[governance] sweep failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
