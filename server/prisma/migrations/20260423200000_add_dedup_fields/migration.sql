-- AlterTable: Add deduplication fields to Prompt
ALTER TABLE "Prompt" ADD COLUMN "titleNormalized" TEXT;
ALTER TABLE "Prompt" ADD COLUMN "bodyHash" TEXT;

-- AlterTable: Add deduplication fields to Skill
ALTER TABLE "Skill" ADD COLUMN "skillUrlNormalized" TEXT;

-- AlterTable: Add deduplication fields to ContextDocument
ALTER TABLE "ContextDocument" ADD COLUMN "titleNormalized" TEXT;
ALTER TABLE "ContextDocument" ADD COLUMN "bodyHash" TEXT;

-- AlterTable: Add deduplication fields to Build
ALTER TABLE "Build" ADD COLUMN "buildUrlNormalized" TEXT;

-- CreateIndex: Unique constraint on Prompt bodyHash (nullable, so duplicates of NULL are allowed)
CREATE UNIQUE INDEX "Prompt_bodyHash_key" ON "Prompt"("bodyHash");

-- CreateIndex: Index on Prompt titleNormalized for fuzzy matching queries
CREATE INDEX "Prompt_titleNormalized_idx" ON "Prompt"("titleNormalized");

-- CreateIndex: Unique constraint on Skill skillUrlNormalized
CREATE UNIQUE INDEX "Skill_skillUrlNormalized_key" ON "Skill"("skillUrlNormalized");

-- CreateIndex: Unique constraint on ContextDocument bodyHash
CREATE UNIQUE INDEX "ContextDocument_bodyHash_key" ON "ContextDocument"("bodyHash");

-- CreateIndex: Index on ContextDocument titleNormalized
CREATE INDEX "ContextDocument_titleNormalized_idx" ON "ContextDocument"("titleNormalized");

-- CreateIndex: Unique constraint on Build buildUrlNormalized
CREATE UNIQUE INDEX "Build_buildUrlNormalized_key" ON "Build"("buildUrlNormalized");
