-- CreateEnum
CREATE TYPE "ToolRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'ON_HOLD');

-- CreateTable
CREATE TABLE "ToolRequest" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "salesforceApproved" BOOLEAN NOT NULL,
    "detailsUrl" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "submitterFirstName" TEXT NOT NULL,
    "submitterLastName" TEXT NOT NULL,
    "submitterEmail" TEXT NOT NULL,
    "status" "ToolRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" INTEGER,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToolRequest_status_createdAt_idx" ON "ToolRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ToolRequest" ADD CONSTRAINT "ToolRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
