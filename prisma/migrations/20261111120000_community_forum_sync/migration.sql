CREATE TABLE "ForumSync" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "forumChannelId" TEXT NOT NULL,
    "guildId" TEXT,
    "threadId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createAttemptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ForumSync_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ForumSync_characterId_key" ON "ForumSync"("characterId");
CREATE UNIQUE INDEX "ForumSync_threadId_key" ON "ForumSync"("threadId");
CREATE INDEX "ForumSync_status_updatedAt_idx" ON "ForumSync"("status", "updatedAt");

CREATE TABLE "ForumSyncJob" (
    "characterId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    CONSTRAINT "ForumSyncJob_pkey" PRIMARY KEY ("characterId")
);

CREATE INDEX "ForumSyncJob_runAfter_idx" ON "ForumSyncJob"("runAfter");

ALTER TABLE "ForumSync" ADD CONSTRAINT "ForumSync_characterId_fkey"
    FOREIGN KEY ("characterId") REFERENCES "CommunityCharacter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForumSyncJob" ADD CONSTRAINT "ForumSyncJob_characterId_fkey"
    FOREIGN KEY ("characterId") REFERENCES "ForumSync"("characterId") ON DELETE CASCADE ON UPDATE CASCADE;
