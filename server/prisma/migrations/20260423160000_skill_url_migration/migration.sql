-- Migration: Convert Skills from body-based to URL-based format
-- This migration:
-- 1. Deletes all existing skills (they need to be recreated with URLs)
-- 2. Removes the SkillVariable table (no longer needed for URL-based skills)
-- 3. Removes the body column from Skill
-- 4. Adds skillUrl (required) and supportUrl (optional) columns

-- First, delete all related data to avoid foreign key constraints
DELETE FROM "SkillUsageEvent";
DELETE FROM "SkillFavorite";
DELETE FROM "SkillRating";
DELETE FROM "SkillVariable";
DELETE FROM "CollectionSkill";

-- Delete all existing skills
DELETE FROM "Skill";

-- Drop the SkillVariable table
DROP TABLE "SkillVariable";

-- Modify the Skill table: remove body, add skillUrl and supportUrl
ALTER TABLE "Skill" DROP COLUMN "body";
ALTER TABLE "Skill" ADD COLUMN "skillUrl" TEXT NOT NULL;
ALTER TABLE "Skill" ADD COLUMN "supportUrl" TEXT;
