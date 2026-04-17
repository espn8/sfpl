-- Add tools column to ContextDocument
ALTER TABLE "ContextDocument"
ADD COLUMN "tools" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
