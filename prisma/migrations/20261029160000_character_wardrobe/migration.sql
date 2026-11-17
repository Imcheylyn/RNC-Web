CREATE TABLE "CommunityCharacterSkin" (
    "characterId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunityCharacterSkin_pkey" PRIMARY KEY ("characterId", "id")
);

CREATE INDEX "CommunityCharacterSkin_characterId_sortOrder_createdAt_idx"
ON "CommunityCharacterSkin"("characterId", "sortOrder", "createdAt");

ALTER TABLE "CommunityCharacterSkin" ADD CONSTRAINT "CommunityCharacterSkin_characterId_fkey"
FOREIGN KEY ("characterId") REFERENCES "CommunityCharacter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
