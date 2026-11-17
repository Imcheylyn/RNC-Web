CREATE TABLE "CommunityLabuuScore" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "targetIds" TEXT[],
    "lastScore" INTEGER,
    "bestScore" INTEGER,
    "bestRemainingMs" INTEGER NOT NULL DEFAULT 0,
    "bestAt" TIMESTAMP(3),

    CONSTRAINT "CommunityLabuuScore_pkey" PRIMARY KEY ("guildId", "userId")
);

CREATE INDEX "CommunityLabuuScore_ranking_idx"
    ON "CommunityLabuuScore" ("guildId", "bestScore" DESC, "bestRemainingMs" DESC, "bestAt", "userId");

ALTER TABLE "CommunityLabuuScore" ADD CONSTRAINT "CommunityLabuuScore_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "CommunityUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
