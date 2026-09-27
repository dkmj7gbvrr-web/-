-- CreateTable
CREATE TABLE "ReplacementItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "lastReplacedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUpdatedById" TEXT,

    CONSTRAINT "ReplacementItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplacementLogEntry" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT,
    "replacedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplacementLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReplacementLogEntry_itemId_replacedAt_idx" ON "ReplacementLogEntry"("itemId", "replacedAt");

-- AddForeignKey
ALTER TABLE "ReplacementItem" ADD CONSTRAINT "ReplacementItem_lastUpdatedById_fkey" FOREIGN KEY ("lastUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplacementLogEntry" ADD CONSTRAINT "ReplacementLogEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ReplacementItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplacementLogEntry" ADD CONSTRAINT "ReplacementLogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
