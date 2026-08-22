-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "importance" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "urgency" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "TaskLogEntry" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskLogEntry_taskId_createdAt_idx" ON "TaskLogEntry"("taskId", "createdAt");

-- AddForeignKey
ALTER TABLE "TaskLogEntry" ADD CONSTRAINT "TaskLogEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskLogEntry" ADD CONSTRAINT "TaskLogEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

