-- AlterTable
ALTER TABLE "User"
ADD COLUMN "region" TEXT,
ADD COLUMN "ou" TEXT,
ADD COLUMN "title" TEXT,
ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
