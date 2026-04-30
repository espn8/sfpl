-- AlterTable
ALTER TABLE "Skill" ADD COLUMN "modality" "PromptModality" NOT NULL DEFAULT 'TEXT';

-- AlterTable
ALTER TABLE "ContextDocument" ADD COLUMN "modality" "PromptModality" NOT NULL DEFAULT 'TEXT';

-- AlterTable
ALTER TABLE "Build" ADD COLUMN "modality" "PromptModality" NOT NULL DEFAULT 'TEXT';
