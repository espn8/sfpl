-- CreateTable
CREATE TABLE "Build" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "buildUrl" TEXT NOT NULL,
    "supportUrl" TEXT,
    "visibility" "PromptVisibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
    "thumbnailUrl" TEXT,
    "thumbnailStatus" "ThumbnailStatus" NOT NULL DEFAULT 'PENDING',
    "thumbnailError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Build_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionBuild" (
    "id" SERIAL NOT NULL,
    "collectionId" INTEGER NOT NULL,
    "buildId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CollectionBuild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillVariable" (
    "id" SERIAL NOT NULL,
    "skillId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT,
    "defaultValue" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SkillVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextVariable" (
    "id" SERIAL NOT NULL,
    "contextId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT,
    "defaultValue" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ContextVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillFavorite" (
    "id" SERIAL NOT NULL,
    "skillId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillUsageEvent" (
    "id" SERIAL NOT NULL,
    "skillId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'VIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextFavorite" (
    "id" SERIAL NOT NULL,
    "contextId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContextFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextUsageEvent" (
    "id" SERIAL NOT NULL,
    "contextId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'VIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContextUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildFavorite" (
    "id" SERIAL NOT NULL,
    "buildId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildUsageEvent" (
    "id" SERIAL NOT NULL,
    "buildId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'VIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildRating" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "buildId" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Build_teamId_updatedAt_idx" ON "Build"("teamId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionBuild_collectionId_buildId_key" ON "CollectionBuild"("collectionId", "buildId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillVariable_skillId_key_key" ON "SkillVariable"("skillId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ContextVariable_contextId_key_key" ON "ContextVariable"("contextId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SkillFavorite_skillId_userId_key" ON "SkillFavorite"("skillId", "userId");

-- CreateIndex
CREATE INDEX "SkillUsageEvent_skillId_idx" ON "SkillUsageEvent"("skillId");

-- CreateIndex
CREATE INDEX "SkillUsageEvent_userId_idx" ON "SkillUsageEvent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContextFavorite_contextId_userId_key" ON "ContextFavorite"("contextId", "userId");

-- CreateIndex
CREATE INDEX "ContextUsageEvent_contextId_idx" ON "ContextUsageEvent"("contextId");

-- CreateIndex
CREATE INDEX "ContextUsageEvent_userId_idx" ON "ContextUsageEvent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildFavorite_buildId_userId_key" ON "BuildFavorite"("buildId", "userId");

-- CreateIndex
CREATE INDEX "BuildUsageEvent_buildId_idx" ON "BuildUsageEvent"("buildId");

-- CreateIndex
CREATE INDEX "BuildUsageEvent_userId_idx" ON "BuildUsageEvent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BuildRating_userId_buildId_key" ON "BuildRating"("userId", "buildId");

-- AddForeignKey
ALTER TABLE "Build" ADD CONSTRAINT "Build_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Build" ADD CONSTRAINT "Build_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionBuild" ADD CONSTRAINT "CollectionBuild_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionBuild" ADD CONSTRAINT "CollectionBuild_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillVariable" ADD CONSTRAINT "SkillVariable_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextVariable" ADD CONSTRAINT "ContextVariable_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "ContextDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillFavorite" ADD CONSTRAINT "SkillFavorite_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillFavorite" ADD CONSTRAINT "SkillFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillUsageEvent" ADD CONSTRAINT "SkillUsageEvent_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillUsageEvent" ADD CONSTRAINT "SkillUsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextFavorite" ADD CONSTRAINT "ContextFavorite_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "ContextDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextFavorite" ADD CONSTRAINT "ContextFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextUsageEvent" ADD CONSTRAINT "ContextUsageEvent_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "ContextDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextUsageEvent" ADD CONSTRAINT "ContextUsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildFavorite" ADD CONSTRAINT "BuildFavorite_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildFavorite" ADD CONSTRAINT "BuildFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildUsageEvent" ADD CONSTRAINT "BuildUsageEvent_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildUsageEvent" ADD CONSTRAINT "BuildUsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildRating" ADD CONSTRAINT "BuildRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildRating" ADD CONSTRAINT "BuildRating_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;
