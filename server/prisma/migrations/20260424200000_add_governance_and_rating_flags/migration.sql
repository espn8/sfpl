-- Phase 4 governance + hybrid ratings migration.
-- Adds:
--   * Per-asset lifecycle fields (lastVerifiedAt, verificationDueAt, warningSentAt,
--     archivedAt, archiveReason) on Prompt, Skill, ContextDocument, Build.
--   * FeedbackFlag[] + comment on Rating, SkillRating, ContextRating, BuildRating.
--   * AssetVerification audit log.
--   * Supporting enums: ArchiveReason, AssetType, VerificationAction, FeedbackFlag.
--   * Composite indexes on (status, verificationDueAt) to keep the nightly
--     governance sweep cheap.
--
-- Backfill: sets lastVerifiedAt = updatedAt and verificationDueAt = updatedAt + 30d
-- for every currently PUBLISHED asset so the first sweep does not auto-archive
-- everything at once.

-- CreateEnum
CREATE TYPE "ArchiveReason" AS ENUM ('MANUAL', 'UNVERIFIED', 'INACTIVE', 'LOW_RATING');
CREATE TYPE "AssetType" AS ENUM ('PROMPT', 'SKILL', 'CONTEXT', 'BUILD');
CREATE TYPE "VerificationAction" AS ENUM ('VERIFIED', 'ARCHIVED', 'UNARCHIVED', 'OWNERSHIP_TRANSFERRED');
CREATE TYPE "FeedbackFlag" AS ENUM ('WORKED_WELL', 'DID_NOT_WORK', 'INACCURATE', 'OUTDATED', 'OFF_TOPIC');

-- AlterTable: Prompt
ALTER TABLE "Prompt"
  ADD COLUMN "lastVerifiedAt"    TIMESTAMP(3),
  ADD COLUMN "verificationDueAt" TIMESTAMP(3),
  ADD COLUMN "warningSentAt"     TIMESTAMP(3),
  ADD COLUMN "archivedAt"        TIMESTAMP(3),
  ADD COLUMN "archiveReason"     "ArchiveReason";

-- AlterTable: Skill
ALTER TABLE "Skill"
  ADD COLUMN "lastVerifiedAt"    TIMESTAMP(3),
  ADD COLUMN "verificationDueAt" TIMESTAMP(3),
  ADD COLUMN "warningSentAt"     TIMESTAMP(3),
  ADD COLUMN "archivedAt"        TIMESTAMP(3),
  ADD COLUMN "archiveReason"     "ArchiveReason";

-- AlterTable: ContextDocument
ALTER TABLE "ContextDocument"
  ADD COLUMN "lastVerifiedAt"    TIMESTAMP(3),
  ADD COLUMN "verificationDueAt" TIMESTAMP(3),
  ADD COLUMN "warningSentAt"     TIMESTAMP(3),
  ADD COLUMN "archivedAt"        TIMESTAMP(3),
  ADD COLUMN "archiveReason"     "ArchiveReason";

-- AlterTable: Build
ALTER TABLE "Build"
  ADD COLUMN "lastVerifiedAt"    TIMESTAMP(3),
  ADD COLUMN "verificationDueAt" TIMESTAMP(3),
  ADD COLUMN "warningSentAt"     TIMESTAMP(3),
  ADD COLUMN "archivedAt"        TIMESTAMP(3),
  ADD COLUMN "archiveReason"     "ArchiveReason";

-- AlterTable: Ratings (add feedbackFlags[] and comment)
ALTER TABLE "Rating"
  ADD COLUMN "feedbackFlags" "FeedbackFlag"[] DEFAULT ARRAY[]::"FeedbackFlag"[],
  ADD COLUMN "comment"       TEXT;

ALTER TABLE "SkillRating"
  ADD COLUMN "feedbackFlags" "FeedbackFlag"[] DEFAULT ARRAY[]::"FeedbackFlag"[],
  ADD COLUMN "comment"       TEXT;

ALTER TABLE "ContextRating"
  ADD COLUMN "feedbackFlags" "FeedbackFlag"[] DEFAULT ARRAY[]::"FeedbackFlag"[],
  ADD COLUMN "comment"       TEXT;

ALTER TABLE "BuildRating"
  ADD COLUMN "feedbackFlags" "FeedbackFlag"[] DEFAULT ARRAY[]::"FeedbackFlag"[],
  ADD COLUMN "comment"       TEXT;

-- CreateTable: AssetVerification audit log
CREATE TABLE "AssetVerification" (
  "id"        SERIAL                NOT NULL,
  "assetType" "AssetType"           NOT NULL,
  "assetId"   INTEGER               NOT NULL,
  "userId"    INTEGER               NOT NULL,
  "action"    "VerificationAction"  NOT NULL,
  "reason"    "ArchiveReason",
  "notes"     TEXT,
  "createdAt" TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetVerification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AssetVerification"
  ADD CONSTRAINT "AssetVerification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "AssetVerification_assetType_assetId_createdAt_idx"
  ON "AssetVerification" ("assetType", "assetId", "createdAt");
CREATE INDEX "AssetVerification_userId_createdAt_idx"
  ON "AssetVerification" ("userId", "createdAt");

-- Indexes for governance sweep
CREATE INDEX "Prompt_status_verificationDueAt_idx"
  ON "Prompt" ("status", "verificationDueAt");
CREATE INDEX "Skill_status_verificationDueAt_idx"
  ON "Skill" ("status", "verificationDueAt");
CREATE INDEX "ContextDocument_status_verificationDueAt_idx"
  ON "ContextDocument" ("status", "verificationDueAt");
CREATE INDEX "Build_status_verificationDueAt_idx"
  ON "Build" ("status", "verificationDueAt");

-- Backfill: seed lastVerifiedAt / verificationDueAt for PUBLISHED assets so the
-- first nightly sweep does not archive everything at once. We use updatedAt as a
-- reasonable proxy for "most recent touch" and give owners a fresh 30-day window.
UPDATE "Prompt"
  SET "lastVerifiedAt"    = "updatedAt",
      "verificationDueAt" = "updatedAt" + INTERVAL '30 days'
  WHERE "status" = 'PUBLISHED';

UPDATE "Skill"
  SET "lastVerifiedAt"    = "updatedAt",
      "verificationDueAt" = "updatedAt" + INTERVAL '30 days'
  WHERE "status" = 'PUBLISHED';

UPDATE "ContextDocument"
  SET "lastVerifiedAt"    = "updatedAt",
      "verificationDueAt" = "updatedAt" + INTERVAL '30 days'
  WHERE "status" = 'PUBLISHED';

UPDATE "Build"
  SET "lastVerifiedAt"    = "updatedAt",
      "verificationDueAt" = "updatedAt" + INTERVAL '30 days'
  WHERE "status" = 'PUBLISHED';
