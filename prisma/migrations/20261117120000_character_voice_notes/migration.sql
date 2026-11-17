ALTER TABLE "CommunityCharacterVoiceLine"
  DROP CONSTRAINT "CommunityCharacterVoiceLine_source",
  ADD CONSTRAINT "CommunityCharacterVoiceLine_source" CHECK (
    ("sourceType" = 'YOUTUBE' AND "youtubeId" IS NOT NULL AND "sourceUrl" IS NULL AND "audioAssetId" IS NULL)
    OR ("sourceType" = 'UPLOAD' AND "audioAssetId" IS NOT NULL AND "youtubeId" IS NULL AND "sourceUrl" IS NULL)
    OR ("sourceType" = 'AUDIO_URL' AND "sourceUrl" IS NOT NULL AND "youtubeId" IS NULL AND "audioAssetId" IS NULL)
    OR ("sourceType" = 'NONE' AND "youtubeId" IS NULL AND "sourceUrl" IS NULL AND "audioAssetId" IS NULL AND "startSeconds" = 0 AND "endSeconds" IS NULL)
  );
