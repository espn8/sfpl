-- Add governance archive reason for assets published before profile setup completed.
ALTER TYPE "ArchiveReason" ADD VALUE 'PROFILE_INCOMPLETE';

-- One-time backfill: archive PUBLISHED assets owned by users who never completed onboarding.
WITH updated_prompts AS (
  UPDATE "Prompt"
  SET
    status = 'ARCHIVED',
    "archivedAt" = NOW(),
    "archiveReason" = 'PROFILE_INCOMPLETE'
  WHERE
    status = 'PUBLISHED'
    AND "ownerId" IN (SELECT id FROM "User" WHERE "onboardingCompleted" = false)
  RETURNING id, "ownerId"
)
INSERT INTO "AssetVerification" ("assetType", "assetId", "userId", "action", "reason", "createdAt")
SELECT 'PROMPT'::"AssetType", id, "ownerId", 'ARCHIVED'::"VerificationAction", 'PROFILE_INCOMPLETE'::"ArchiveReason", NOW()
FROM updated_prompts;

WITH updated_skills AS (
  UPDATE "Skill"
  SET
    status = 'ARCHIVED',
    "archivedAt" = NOW(),
    "archiveReason" = 'PROFILE_INCOMPLETE'
  WHERE
    status = 'PUBLISHED'
    AND "ownerId" IN (SELECT id FROM "User" WHERE "onboardingCompleted" = false)
  RETURNING id, "ownerId"
)
INSERT INTO "AssetVerification" ("assetType", "assetId", "userId", "action", "reason", "createdAt")
SELECT 'SKILL'::"AssetType", id, "ownerId", 'ARCHIVED'::"VerificationAction", 'PROFILE_INCOMPLETE'::"ArchiveReason", NOW()
FROM updated_skills;

WITH updated_context AS (
  UPDATE "ContextDocument"
  SET
    status = 'ARCHIVED',
    "archivedAt" = NOW(),
    "archiveReason" = 'PROFILE_INCOMPLETE'
  WHERE
    status = 'PUBLISHED'
    AND "ownerId" IN (SELECT id FROM "User" WHERE "onboardingCompleted" = false)
  RETURNING id, "ownerId"
)
INSERT INTO "AssetVerification" ("assetType", "assetId", "userId", "action", "reason", "createdAt")
SELECT 'CONTEXT'::"AssetType", id, "ownerId", 'ARCHIVED'::"VerificationAction", 'PROFILE_INCOMPLETE'::"ArchiveReason", NOW()
FROM updated_context;

WITH updated_builds AS (
  UPDATE "Build"
  SET
    status = 'ARCHIVED',
    "archivedAt" = NOW(),
    "archiveReason" = 'PROFILE_INCOMPLETE'
  WHERE
    status = 'PUBLISHED'
    AND "ownerId" IN (SELECT id FROM "User" WHERE "onboardingCompleted" = false)
  RETURNING id, "ownerId"
)
INSERT INTO "AssetVerification" ("assetType", "assetId", "userId", "action", "reason", "createdAt")
SELECT 'BUILD'::"AssetType", id, "ownerId", 'ARCHIVED'::"VerificationAction", 'PROFILE_INCOMPLETE'::"ArchiveReason", NOW()
FROM updated_builds;
