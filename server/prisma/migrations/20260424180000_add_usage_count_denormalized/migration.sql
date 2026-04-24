-- Phase 3 homepage perf: denormalize the usage count (COPY / LAUNCH events)
-- onto each asset table so sort=mostUsed and the "usageCount" field in list
-- responses no longer require a groupBy over the per-asset usage-event tables
-- on every request.
--
-- We backfill in the same migration so the column is correct immediately on
-- deploy and the application can start reading it right away. Ongoing writes
-- are kept in sync by the usage-logging endpoints (see
-- server/src/routes/{prompts,skills,context,builds}.ts).

-- AlterTable: add usageCount columns (NOT NULL DEFAULT 0 so no downtime).
ALTER TABLE "Prompt"          ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Skill"           ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ContextDocument" ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Build"           ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill from existing usage event tables.
-- For prompts, "usage" has historically meant action in (COPY, LAUNCH).
UPDATE "Prompt" AS p
SET "usageCount" = sub.count
FROM (
  SELECT "promptId", COUNT(*)::int AS count
  FROM "UsageEvent"
  WHERE "action" IN ('COPY', 'LAUNCH')
  GROUP BY "promptId"
) AS sub
WHERE p.id = sub."promptId";

UPDATE "Skill" AS s
SET "usageCount" = sub.count
FROM (
  SELECT "skillId", COUNT(*)::int AS count
  FROM "SkillUsageEvent"
  WHERE "eventType" = 'COPY'
  GROUP BY "skillId"
) AS sub
WHERE s.id = sub."skillId";

UPDATE "ContextDocument" AS c
SET "usageCount" = sub.count
FROM (
  SELECT "contextId", COUNT(*)::int AS count
  FROM "ContextUsageEvent"
  WHERE "eventType" = 'COPY'
  GROUP BY "contextId"
) AS sub
WHERE c.id = sub."contextId";

UPDATE "Build" AS b
SET "usageCount" = sub.count
FROM (
  SELECT "buildId", COUNT(*)::int AS count
  FROM "BuildUsageEvent"
  WHERE "eventType" = 'COPY'
  GROUP BY "buildId"
) AS sub
WHERE b.id = sub."buildId";

-- CreateIndex: support sort=mostUsed and mine filters scoped to a team.
CREATE INDEX "Prompt_teamId_usageCount_idx"          ON "Prompt"          ("teamId", "usageCount");
CREATE INDEX "Skill_teamId_usageCount_idx"           ON "Skill"           ("teamId", "usageCount");
CREATE INDEX "ContextDocument_teamId_usageCount_idx" ON "ContextDocument" ("teamId", "usageCount");
CREATE INDEX "Build_teamId_usageCount_idx"           ON "Build"           ("teamId", "usageCount");
