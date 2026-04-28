-- CreateEnum
CREATE TYPE "TagRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'ON_HOLD');

-- CreateTable
CREATE TABLE "SkillTag" (
    "id" SERIAL NOT NULL,
    "skillId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "SkillTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextTag" (
    "id" SERIAL NOT NULL,
    "contextId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "ContextTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildTag" (
    "id" SERIAL NOT NULL,
    "buildId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "BuildTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagRequest" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "requestedName" TEXT NOT NULL,
    "description" TEXT,
    "submitterEmail" TEXT NOT NULL,
    "submitterFirstName" TEXT NOT NULL,
    "submitterLastName" TEXT NOT NULL,
    "status" "TagRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" INTEGER,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TagRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SkillTag_skillId_tagId_key" ON "SkillTag"("skillId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "ContextTag_contextId_tagId_key" ON "ContextTag"("contextId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildTag_buildId_tagId_key" ON "BuildTag"("buildId", "tagId");

-- CreateIndex
CREATE INDEX "TagRequest_teamId_status_createdAt_idx" ON "TagRequest"("teamId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "SkillTag" ADD CONSTRAINT "SkillTag_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTag" ADD CONSTRAINT "SkillTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextTag" ADD CONSTRAINT "ContextTag_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "ContextDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextTag" ADD CONSTRAINT "ContextTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildTag" ADD CONSTRAINT "BuildTag_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildTag" ADD CONSTRAINT "BuildTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagRequest" ADD CONSTRAINT "TagRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagRequest" ADD CONSTRAINT "TagRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
