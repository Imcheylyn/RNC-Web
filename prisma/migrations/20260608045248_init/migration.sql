-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "lobbyMessageId" TEXT NOT NULL DEFAULT '',
    "combatMessageId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'lobby',
    "maxSlots" INTEGER NOT NULL DEFAULT 4,
    "forumChannelId" TEXT,
    "monsterForumChannelId" TEXT,
    "monsterRollMode" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "hp" INTEGER NOT NULL,
    "maxHp" INTEGER NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "tupperName" TEXT,
    "avatarUrl" TEXT,
    "statCore" INTEGER NOT NULL DEFAULT 0,
    "statMnf" INTEGER NOT NULL DEFAULT 0,
    "statRfx" INTEGER NOT NULL DEFAULT 0,
    "statScr" INTEGER NOT NULL DEFAULT 0,
    "statDef" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_channelId_key" ON "Session"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_sessionId_slotIndex_key" ON "Player"("sessionId", "slotIndex");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
