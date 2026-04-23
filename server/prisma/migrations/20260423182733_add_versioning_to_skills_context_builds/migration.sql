-- AlterTable
ALTER TABLE "ContextDocument" ADD COLUMN     "supportUrl" TEXT;

-- CreateTable
CREATE TABLE "SkillVersion" (
    "id" SERIAL NOT NULL,
    "skillId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "skillUrl" TEXT NOT NULL,
    "supportUrl" TEXT,
    "changelog" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextVersion" (
    "id" SERIAL NOT NULL,
    "contextId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "supportUrl" TEXT,
    "changelog" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContextVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildVersion" (
    "id" SERIAL NOT NULL,
    "buildId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "buildUrl" TEXT NOT NULL,
    "supportUrl" TEXT,
    "changelog" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SkillVersion_skillId_version_key" ON "SkillVersion"("skillId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ContextVersion_contextId_version_key" ON "ContextVersion"("contextId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "BuildVersion_buildId_version_key" ON "BuildVersion"("buildId", "version");

-- AddForeignKey
ALTER TABLE "SkillVersion" ADD CONSTRAINT "SkillVersion_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillVersion" ADD CONSTRAINT "SkillVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextVersion" ADD CONSTRAINT "ContextVersion_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "ContextDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextVersion" ADD CONSTRAINT "ContextVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildVersion" ADD CONSTRAINT "BuildVersion_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildVersion" ADD CONSTRAINT "BuildVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
