-- Create thumbnail generation status enum.
CREATE TYPE "ThumbnailStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- Add generated thumbnail fields to prompts.
ALTER TABLE "Prompt"
ADD COLUMN "thumbnailUrl" TEXT,
ADD COLUMN "thumbnailStatus" "ThumbnailStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "thumbnailError" TEXT;
