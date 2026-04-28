-- Global Tag vocabulary: merge duplicates by lower(name), drop Tag.teamId; global TagRequest (drop teamId).

-- 0) Temp map: old tag id -> canonical tag id (min id per LOWER(TRIM(name)))
CREATE TEMP TABLE IF NOT EXISTS _tag_merge AS
SELECT t.id AS old_id,
  (SELECT MIN(t2.id) FROM "Tag" t2 WHERE LOWER(TRIM(t2.name)) = LOWER(TRIM(t.name))) AS keep_id
FROM "Tag" t;

-- 1) Repoint junctions (only when schema has these tables — created in 20260428140000)
UPDATE "PromptTag" pt
SET "tagId" = m.keep_id
FROM _tag_merge m
WHERE pt."tagId" = m.old_id AND m.old_id <> m.keep_id;

UPDATE "SkillTag" st
SET "tagId" = m.keep_id
FROM _tag_merge m
WHERE st."tagId" = m.old_id AND m.old_id <> m.keep_id;

UPDATE "ContextTag" ct
SET "tagId" = m.keep_id
FROM _tag_merge m
WHERE ct."tagId" = m.old_id AND m.old_id <> m.keep_id;

UPDATE "BuildTag" bt
SET "tagId" = m.keep_id
FROM _tag_merge m
WHERE bt."tagId" = m.old_id AND m.old_id <> m.keep_id;

-- 2) Dedupe junction rows
DELETE FROM "PromptTag" a USING "PromptTag" b
WHERE a."promptId" = b."promptId" AND a."tagId" = b."tagId" AND a.id > b.id;

DELETE FROM "SkillTag" a USING "SkillTag" b
WHERE a."skillId" = b."skillId" AND a."tagId" = b."tagId" AND a.id > b.id;

DELETE FROM "ContextTag" a USING "ContextTag" b
WHERE a."contextId" = b."contextId" AND a."tagId" = b."tagId" AND a.id > b.id;

DELETE FROM "BuildTag" a USING "BuildTag" b
WHERE a."buildId" = b."buildId" AND a."tagId" = b."tagId" AND a.id > b.id;

-- 3) Remove non-canonical Tag rows
DELETE FROM "Tag" t
WHERE EXISTS (
  SELECT 1 FROM _tag_merge m WHERE m.old_id = t.id AND m.old_id <> m.keep_id
);

DROP TABLE IF EXISTS _tag_merge;

UPDATE "Tag" SET name = TRIM(name);

-- 4) Drop team column and FK on Tag
ALTER TABLE "Tag" DROP CONSTRAINT IF EXISTS "Tag_teamId_fkey";
ALTER TABLE "Tag" DROP CONSTRAINT IF EXISTS "Tag_teamId_name_key";
ALTER TABLE "Tag" DROP COLUMN IF EXISTS "teamId";

-- 5) Unique name (global)
DROP INDEX IF EXISTS "Tag_name_key";
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_name_key" UNIQUE ("name");

-- 6) TagRequest: drop teamId if present
ALTER TABLE "TagRequest" DROP CONSTRAINT IF EXISTS "TagRequest_teamId_fkey";
DROP INDEX IF EXISTS "TagRequest_teamId_status_createdAt_idx";
ALTER TABLE "TagRequest" DROP COLUMN IF EXISTS "teamId";
CREATE INDEX IF NOT EXISTS "TagRequest_status_createdAt_idx" ON "TagRequest"("status", "createdAt");
