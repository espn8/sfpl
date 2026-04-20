-- AlterTable
ALTER TABLE "Skill" ADD COLUMN "thumbnailUrl" TEXT,
ADD COLUMN "thumbnailStatus" "ThumbnailStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "thumbnailError" TEXT;

-- AlterTable
ALTER TABLE "ContextDocument" ADD COLUMN "thumbnailUrl" TEXT,
ADD COLUMN "thumbnailStatus" "ThumbnailStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "thumbnailError" TEXT;
