ALTER TABLE "CommunityCharacter"
  ADD COLUMN "weaponData" JSONB NOT NULL DEFAULT '[]'::jsonb;
