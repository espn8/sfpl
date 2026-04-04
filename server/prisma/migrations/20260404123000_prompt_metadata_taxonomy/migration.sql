-- Create controlled enum for prompt modality.
CREATE TYPE "PromptModality" AS ENUM ('TEXT', 'CODE', 'IMAGE', 'VIDEO', 'AUDIO', 'MULTIMODAL');

-- Add new tools taxonomy field.
ALTER TABLE "Prompt"
ADD COLUMN "tools" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill tools from modelHint when values match canonical/synonym forms.
UPDATE "Prompt"
SET "tools" = CASE
  WHEN lower(trim(coalesce("modelHint", ''))) IN ('cursor') THEN ARRAY['cursor']
  WHEN lower(trim(coalesce("modelHint", ''))) IN ('claude code', 'claude_code', 'claudecode') THEN ARRAY['claude_code']
  WHEN lower(trim(coalesce("modelHint", ''))) IN ('meshmesh') THEN ARRAY['meshmesh']
  WHEN lower(trim(coalesce("modelHint", ''))) IN ('slackbot', 'slack bot') THEN ARRAY['slackbot']
  WHEN lower(trim(coalesce("modelHint", ''))) IN ('gemini') THEN ARRAY['gemini']
  WHEN lower(trim(coalesce("modelHint", ''))) IN ('notebooklm', 'notebook lm') THEN ARRAY['notebooklm']
  ELSE ARRAY[]::TEXT[]
END;

-- Convert free-text modality into controlled enum using a temporary column.
ALTER TABLE "Prompt"
ADD COLUMN "modality_next" "PromptModality" NOT NULL DEFAULT 'TEXT';

UPDATE "Prompt"
SET "modality_next" = CASE
  WHEN lower(trim(coalesce("modality", ''))) = 'code' THEN 'CODE'::"PromptModality"
  WHEN lower(trim(coalesce("modality", ''))) = 'image' THEN 'IMAGE'::"PromptModality"
  WHEN lower(trim(coalesce("modality", ''))) = 'video' THEN 'VIDEO'::"PromptModality"
  WHEN lower(trim(coalesce("modality", ''))) = 'audio' THEN 'AUDIO'::"PromptModality"
  WHEN lower(trim(coalesce("modality", ''))) IN ('multimodal', 'multi-modal', 'multi modal') THEN 'MULTIMODAL'::"PromptModality"
  ELSE 'TEXT'::"PromptModality"
END;

ALTER TABLE "Prompt" DROP COLUMN "modality";
ALTER TABLE "Prompt" RENAME COLUMN "modality_next" TO "modality";
