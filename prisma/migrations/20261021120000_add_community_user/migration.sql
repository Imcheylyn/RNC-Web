-- Store Discord accounts that have passed Community membership verification.
CREATE TABLE "CommunityUser" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityUser_discordId_key" ON "CommunityUser"("discordId");
