-- CreateTable
CREATE TABLE "UserProfileFavorite" (
    "id" SERIAL NOT NULL,
    "fanUserId" INTEGER NOT NULL,
    "targetUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProfileFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfileFavorite_fanUserId_targetUserId_key" ON "UserProfileFavorite"("fanUserId", "targetUserId");

-- AddForeignKey
ALTER TABLE "UserProfileFavorite" ADD CONSTRAINT "UserProfileFavorite_fanUserId_fkey" FOREIGN KEY ("fanUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfileFavorite" ADD CONSTRAINT "UserProfileFavorite_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
