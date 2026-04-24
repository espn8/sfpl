/**
 * Dev-only EXPLAIN ANALYZE harness for the /api/assets hot queries.
 *
 * Usage:
 *   USER_ID=12 TEAM_ID=3 tsx server/scripts/explainAssets.ts
 *
 * Prints the Postgres query plan + actual timing for the handful of queries
 * that dominate `GET /api/assets`. Use this after `PERF_LOG=1` logs identify
 * a slow section - it tells you whether the DB is doing sequential scans or
 * hitting an index.
 *
 * This script intentionally reads values from env vars instead of logging in
 * via the auth middleware so it can be run standalone against local or
 * staging databases without touching a session store.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

type ExplainRow = { "QUERY PLAN": string };

const userId = Number(process.env.USER_ID ?? 1);
const teamId = Number(process.env.TEAM_ID ?? 1);
const idSampleSize = Number(process.env.ID_SAMPLE_SIZE ?? 60);

if (!Number.isFinite(userId) || !Number.isFinite(teamId)) {
  // eslint-disable-next-line no-console
  console.error("USER_ID and TEAM_ID must be numeric");
  process.exit(1);
}

async function explain(label: string, sql: string, params: unknown[] = []): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`\n===== ${label} =====`);
  // eslint-disable-next-line no-console
  console.log(sql.replace(/\s+/g, " ").trim());
  try {
    const rows = await prisma.$queryRawUnsafe<ExplainRow[]>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`,
      ...params,
    );
    for (const row of rows) {
      // eslint-disable-next-line no-console
      console.log(row["QUERY PLAN"]);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`  [failed] ${(err as Error).message}`);
  }
}

async function sampleIds(table: string, teamColumn: string, limit: number): Promise<number[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id FROM "${table}" WHERE "${teamColumn}" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
    teamId,
    limit,
  );
  return rows.map((r) => r.id);
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`Running EXPLAIN ANALYZE with userId=${userId} teamId=${teamId}`);

  const [promptIds, skillIds, contextIds, buildIds] = await Promise.all([
    sampleIds("Prompt", "teamId", idSampleSize),
    sampleIds("Skill", "teamId", idSampleSize),
    sampleIds("ContextDocument", "teamId", idSampleSize),
    sampleIds("Build", "teamId", idSampleSize),
  ]);

  // eslint-disable-next-line no-console
  console.log(
    `sampled ids: prompts=${promptIds.length} skills=${skillIds.length} context=${contextIds.length} builds=${buildIds.length}`,
  );

  if (promptIds.length > 0) {
    await explain(
      "UsageEvent groupBy(promptId) VIEW",
      `SELECT "promptId", COUNT(*) FROM "UsageEvent" WHERE "promptId" = ANY($1::int[]) AND "action" = 'VIEW' GROUP BY "promptId"`,
      [promptIds],
    );
    await explain(
      "UsageEvent groupBy(promptId) COPY/LAUNCH",
      `SELECT "promptId", COUNT(*) FROM "UsageEvent" WHERE "promptId" = ANY($1::int[]) AND "action" IN ('COPY','LAUNCH') GROUP BY "promptId"`,
      [promptIds],
    );
    await explain(
      "Favorite groupBy(promptId)",
      `SELECT "promptId", COUNT(*) FROM "Favorite" WHERE "promptId" = ANY($1::int[]) GROUP BY "promptId"`,
      [promptIds],
    );
  }

  if (skillIds.length > 0) {
    await explain(
      "SkillUsageEvent groupBy(skillId) VIEW",
      `SELECT "skillId", COUNT(*) FROM "SkillUsageEvent" WHERE "skillId" = ANY($1::int[]) AND "eventType" = 'VIEW' GROUP BY "skillId"`,
      [skillIds],
    );
    await explain(
      "SkillUsageEvent groupBy(skillId) COPY",
      `SELECT "skillId", COUNT(*) FROM "SkillUsageEvent" WHERE "skillId" = ANY($1::int[]) AND "eventType" = 'COPY' GROUP BY "skillId"`,
      [skillIds],
    );
    await explain(
      "SkillRating groupBy(skillId)",
      `SELECT "skillId", COUNT(*), AVG("value") FROM "SkillRating" WHERE "skillId" = ANY($1::int[]) GROUP BY "skillId"`,
      [skillIds],
    );
  }

  if (contextIds.length > 0) {
    await explain(
      "ContextUsageEvent groupBy(contextId) VIEW",
      `SELECT "contextId", COUNT(*) FROM "ContextUsageEvent" WHERE "contextId" = ANY($1::int[]) AND "eventType" = 'VIEW' GROUP BY "contextId"`,
      [contextIds],
    );
  }

  if (buildIds.length > 0) {
    await explain(
      "BuildUsageEvent groupBy(buildId) VIEW",
      `SELECT "buildId", COUNT(*) FROM "BuildUsageEvent" WHERE "buildId" = ANY($1::int[]) AND "eventType" = 'VIEW' GROUP BY "buildId"`,
      [buildIds],
    );
  }

  await explain(
    "snapshot prompt count",
    `SELECT COUNT(*) FROM "Prompt" WHERE "status" = 'PUBLISHED'`,
  );
  await explain(
    "snapshot usageEvent count",
    `SELECT COUNT(*) FROM "UsageEvent" u WHERE u."action" IN ('COPY','LAUNCH') AND EXISTS (SELECT 1 FROM "Prompt" p WHERE p."id" = u."promptId" AND p."teamId" = $1)`,
    [teamId],
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
