-- Persist real Community character profiles under the Discord account that created them.
CREATE TABLE "CommunityCharacter" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "legacyId" TEXT,
    "name" TEXT NOT NULL,
    "byname" TEXT NOT NULL DEFAULT '',
    "era" TEXT NOT NULL DEFAULT '',
    "quote" TEXT NOT NULL DEFAULT '',
    "nickname" TEXT NOT NULL DEFAULT '',
    "age" TEXT NOT NULL DEFAULT '',
    "gender" TEXT NOT NULL DEFAULT '',
    "nationality" TEXT NOT NULL DEFAULT '',
    "heightWeight" TEXT NOT NULL DEFAULT '',
    "race" TEXT NOT NULL DEFAULT '',
    "arcana" TEXT NOT NULL DEFAULT '',
    "rank" INTEGER,
    "position" TEXT NOT NULL DEFAULT '',
    "stats" JSONB NOT NULL DEFAULT '{}',
    "mediumName" TEXT NOT NULL DEFAULT '',
    "mediumDescription" TEXT NOT NULL DEFAULT '',
    "abilityDescription" TEXT NOT NULL DEFAULT '',
    "limitations" TEXT NOT NULL DEFAULT '',
    "likes" TEXT NOT NULL DEFAULT '',
    "dislikes" TEXT NOT NULL DEFAULT '',
    "personality" TEXT NOT NULL DEFAULT '',
    "history" TEXT NOT NULL DEFAULT '',
    "playstyle" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "discord" TEXT NOT NULL DEFAULT '',
    "other" TEXT NOT NULL DEFAULT '',
    "galleryCrop" JSONB,
    "archiveCategory" TEXT NOT NULL DEFAULT 'Character',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunityCharacter_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommunityCharacter_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "CommunityUser"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CommunityCharacter_ownerId_legacyId_key"
  ON "CommunityCharacter"("ownerId", "legacyId");
CREATE INDEX "CommunityCharacter_ownerId_updatedAt_idx"
  ON "CommunityCharacter"("ownerId", "updatedAt");
CREATE INDEX "CommunityCharacter_archiveCategory_idx"
  ON "CommunityCharacter"("archiveCategory");

-- Keep image files separate from character text and expose stable asset URLs.
CREATE TABLE "CommunityCharacterAsset" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityCharacterAsset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommunityCharacterAsset_characterId_fkey"
      FOREIGN KEY ("characterId") REFERENCES "CommunityCharacter"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CommunityCharacterAsset_characterId_kind_key"
  ON "CommunityCharacterAsset"("characterId", "kind");
CREATE INDEX "CommunityCharacterAsset_characterId_idx"
  ON "CommunityCharacterAsset"("characterId");
