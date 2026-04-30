-- First publish timestamp (immutable after set by app); backfill legacy published rows.
ALTER TABLE "Prompt" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "Skill" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "ContextDocument" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "Build" ADD COLUMN "publishedAt" TIMESTAMP(3);

UPDATE "Prompt" SET "publishedAt" = "createdAt" WHERE status = 'PUBLISHED' AND "publishedAt" IS NULL;
UPDATE "Skill" SET "publishedAt" = "createdAt" WHERE status = 'PUBLISHED' AND "publishedAt" IS NULL;
UPDATE "ContextDocument" SET "publishedAt" = "createdAt" WHERE status = 'PUBLISHED' AND "publishedAt" IS NULL;
UPDATE "Build" SET "publishedAt" = "createdAt" WHERE status = 'PUBLISHED' AND "publishedAt" IS NULL;

CREATE INDEX "Prompt_status_publishedAt_idx" ON "Prompt"("status", "publishedAt");
CREATE INDEX "Skill_status_publishedAt_idx" ON "Skill"("status", "publishedAt");
CREATE INDEX "ContextDocument_status_publishedAt_idx" ON "ContextDocument"("status", "publishedAt");
CREATE INDEX "Build_status_publishedAt_idx" ON "Build"("status", "publishedAt");

-- Collection membership audit (who added, when).
ALTER TABLE "CollectionPrompt" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CollectionPrompt" ADD COLUMN "addedById" INTEGER;

UPDATE "CollectionPrompt" cp
SET "addedById" = c."createdById"
FROM "Collection" c
WHERE cp."collectionId" = c.id AND cp."addedById" IS NULL;

ALTER TABLE "CollectionPrompt" ALTER COLUMN "addedById" SET NOT NULL;
ALTER TABLE "CollectionPrompt" ADD CONSTRAINT "CollectionPrompt_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "CollectionPrompt_addedById_createdAt_idx" ON "CollectionPrompt"("addedById", "createdAt");

ALTER TABLE "CollectionSkill" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CollectionSkill" ADD COLUMN "addedById" INTEGER;

UPDATE "CollectionSkill" cs
SET "addedById" = c."createdById"
FROM "Collection" c
WHERE cs."collectionId" = c.id AND cs."addedById" IS NULL;

ALTER TABLE "CollectionSkill" ALTER COLUMN "addedById" SET NOT NULL;
ALTER TABLE "CollectionSkill" ADD CONSTRAINT "CollectionSkill_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "CollectionSkill_addedById_createdAt_idx" ON "CollectionSkill"("addedById", "createdAt");

ALTER TABLE "CollectionContext" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CollectionContext" ADD COLUMN "addedById" INTEGER;

UPDATE "CollectionContext" cc
SET "addedById" = c."createdById"
FROM "Collection" c
WHERE cc."collectionId" = c.id AND cc."addedById" IS NULL;

ALTER TABLE "CollectionContext" ALTER COLUMN "addedById" SET NOT NULL;
ALTER TABLE "CollectionContext" ADD CONSTRAINT "CollectionContext_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "CollectionContext_addedById_createdAt_idx" ON "CollectionContext"("addedById", "createdAt");

ALTER TABLE "CollectionBuild" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CollectionBuild" ADD COLUMN "addedById" INTEGER;

UPDATE "CollectionBuild" cb
SET "addedById" = c."createdById"
FROM "Collection" c
WHERE cb."collectionId" = c.id AND cb."addedById" IS NULL;

ALTER TABLE "CollectionBuild" ALTER COLUMN "addedById" SET NOT NULL;
ALTER TABLE "CollectionBuild" ADD CONSTRAINT "CollectionBuild_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "CollectionBuild_addedById_createdAt_idx" ON "CollectionBuild"("addedById", "createdAt");
