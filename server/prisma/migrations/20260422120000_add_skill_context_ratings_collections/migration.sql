-- CreateTable
CREATE TABLE "CollectionSkill" (
    "id" SERIAL NOT NULL,
    "collectionId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CollectionSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionContext" (
    "id" SERIAL NOT NULL,
    "collectionId" INTEGER NOT NULL,
    "contextId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CollectionContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillRating" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextRating" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "contextId" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContextRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CollectionSkill_collectionId_skillId_key" ON "CollectionSkill"("collectionId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionContext_collectionId_contextId_key" ON "CollectionContext"("collectionId", "contextId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillRating_userId_skillId_key" ON "SkillRating"("userId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "ContextRating_userId_contextId_key" ON "ContextRating"("userId", "contextId");

-- AddForeignKey
ALTER TABLE "CollectionSkill" ADD CONSTRAINT "CollectionSkill_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionSkill" ADD CONSTRAINT "CollectionSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionContext" ADD CONSTRAINT "CollectionContext_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionContext" ADD CONSTRAINT "CollectionContext_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "ContextDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillRating" ADD CONSTRAINT "SkillRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillRating" ADD CONSTRAINT "SkillRating_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextRating" ADD CONSTRAINT "ContextRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextRating" ADD CONSTRAINT "ContextRating_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "ContextDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
