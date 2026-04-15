-- CreateTable
CREATE TABLE "Skill" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "visibility" "PromptVisibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextDocument" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "visibility" "PromptVisibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContextDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Skill_teamId_updatedAt_idx" ON "Skill"("teamId", "updatedAt");

-- CreateIndex
CREATE INDEX "ContextDocument_teamId_updatedAt_idx" ON "ContextDocument"("teamId", "updatedAt");

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextDocument" ADD CONSTRAINT "ContextDocument_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextDocument" ADD CONSTRAINT "ContextDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
