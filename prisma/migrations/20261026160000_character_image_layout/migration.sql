ALTER TABLE "CommunityCharacter"
  ADD COLUMN "imageLayout" JSONB NOT NULL DEFAULT '{}'::jsonb;
