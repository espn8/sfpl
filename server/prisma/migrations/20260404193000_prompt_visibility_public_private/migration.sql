-- Rename legacy visibility enum value TEAM to PUBLIC
ALTER TYPE "PromptVisibility" RENAME VALUE 'TEAM' TO 'PUBLIC';

-- Ensure default reflects new public/private model
ALTER TABLE "Prompt" ALTER COLUMN "visibility" SET DEFAULT 'PUBLIC';
