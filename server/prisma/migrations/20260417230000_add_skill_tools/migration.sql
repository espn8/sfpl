-- Add tools column to Skill
ALTER TABLE "Skill"
ADD COLUMN "tools" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
