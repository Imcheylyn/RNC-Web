CREATE TABLE "CommunityLabuuRunScore" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "lastScore" INTEGER,
    "bestScore" INTEGER,
    "bestAt" TIMESTAMP(3),

    CONSTRAINT "CommunityLabuuRunScore_pkey" PRIMARY KEY ("guildId", "userId")
);

CREATE INDEX "CommunityLabuuRunScore_ranking_idx"
    ON "CommunityLabuuRunScore" ("guildId", "bestScore" DESC, "bestAt", "userId");

ALTER TABLE "CommunityLabuuRunScore" ADD CONSTRAINT "CommunityLabuuRunScore_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "CommunityUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
