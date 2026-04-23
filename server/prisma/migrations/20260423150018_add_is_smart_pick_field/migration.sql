-- AlterTable
ALTER TABLE "Build" ADD COLUMN     "isSmartPick" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ContextDocument" ADD COLUMN     "isSmartPick" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Prompt" ADD COLUMN     "isSmartPick" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Skill" ADD COLUMN     "isSmartPick" BOOLEAN NOT NULL DEFAULT false;
