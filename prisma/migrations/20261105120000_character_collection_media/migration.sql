-- Character collection: additive tables only; existing characters, images, skills and weapons remain unchanged.
BEGIN;

CREATE TABLE "CommunityCharacterRelationship" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunityCharacterRelationship_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommunityCharacterRelationship_sourceId_targetId_key" ON "CommunityCharacterRelationship"("sourceId", "targetId");
CREATE INDEX "CommunityCharacterRelationship_targetId_updatedAt_idx" ON "CommunityCharacterRelationship"("targetId", "updatedAt");
ALTER TABLE "CommunityCharacterRelationship" ADD CONSTRAINT "CommunityCharacterRelationship_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CommunityCharacter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityCharacterRelationship" ADD CONSTRAINT "CommunityCharacterRelationship_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "CommunityCharacter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommunityMediaAsset" (
    "id" TEXT NOT NULL,
    "uploaderId" TEXT,
    "characterId" TEXT,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "storageBucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "attachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunityMediaAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommunityMediaAsset_storageKey_key" ON "CommunityMediaAsset"("storageKey");
CREATE INDEX "CommunityMediaAsset_characterId_status_idx" ON "CommunityMediaAsset"("characterId", "status");
CREATE INDEX "CommunityMediaAsset_uploaderId_createdAt_idx" ON "CommunityMediaAsset"("uploaderId", "createdAt");
CREATE INDEX "CommunityMediaAsset_attachedAt_createdAt_idx" ON "CommunityMediaAsset"("attachedAt", "createdAt");
ALTER TABLE "CommunityMediaAsset" ADD CONSTRAINT "CommunityMediaAsset_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "CommunityUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunityMediaAsset" ADD CONSTRAINT "CommunityMediaAsset_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "CommunityCharacter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommunityCharacterVoiceLine" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "transcript" TEXT NOT NULL DEFAULT '',
    "credit" TEXT NOT NULL DEFAULT '',
    "sourceType" TEXT NOT NULL,
    "youtubeId" TEXT,
    "sourceUrl" TEXT,
    "audioAssetId" TEXT,
    "startSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "endSeconds" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunityCharacterVoiceLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CommunityCharacterVoiceLine_characterId_sortOrder_createdAt_idx" ON "CommunityCharacterVoiceLine"("characterId", "sortOrder", "createdAt");
ALTER TABLE "CommunityCharacterVoiceLine" ADD CONSTRAINT "CommunityCharacterVoiceLine_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "CommunityCharacter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityCharacterVoiceLine" ADD CONSTRAINT "CommunityCharacterVoiceLine_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "CommunityMediaAsset"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE TABLE "CommunityCharacterThemeSong" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL DEFAULT '',
    "sourceType" TEXT NOT NULL,
    "youtubeId" TEXT,
    "sourceUrl" TEXT,
    "audioAssetId" TEXT,
    "coverAssetId" TEXT,
    "startSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "endSeconds" DOUBLE PRECISION,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunityCharacterThemeSong_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommunityCharacterThemeSong_characterId_key" ON "CommunityCharacterThemeSong"("characterId");
ALTER TABLE "CommunityCharacterThemeSong" ADD CONSTRAINT "CommunityCharacterThemeSong_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "CommunityCharacter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityCharacterThemeSong" ADD CONSTRAINT "CommunityCharacterThemeSong_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "CommunityMediaAsset"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "CommunityCharacterThemeSong" ADD CONSTRAINT "CommunityCharacterThemeSong_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "CommunityMediaAsset"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "CommunityCharacterRelationship" ADD CONSTRAINT "Relationship_not_self" CHECK ("sourceId" <> "targetId"), ADD CONSTRAINT "Relationship_version" CHECK ("version" > 0);
ALTER TABLE "CommunityMediaAsset" ADD CONSTRAINT "Media_purpose_status_size" CHECK ("purpose" IN ('AUDIO','COVER') AND "status" IN ('PENDING','READY') AND "byteSize" > 0), ADD CONSTRAINT "Media_attachment" CHECK ("attachedAt" IS NULL OR "characterId" IS NOT NULL);
ALTER TABLE "CommunityCharacterVoiceLine" ADD CONSTRAINT "CommunityCharacterVoiceLine_bounds" CHECK ("startSeconds" >= 0 AND ("endSeconds" IS NULL OR "endSeconds" > "startSeconds") AND "version" > 0), ADD CONSTRAINT "CommunityCharacterVoiceLine_source" CHECK (("sourceType" = 'YOUTUBE' AND "youtubeId" IS NOT NULL AND "sourceUrl" IS NULL AND "audioAssetId" IS NULL) OR ("sourceType" = 'UPLOAD' AND "audioAssetId" IS NOT NULL AND "youtubeId" IS NULL AND "sourceUrl" IS NULL) OR ("sourceType" = 'AUDIO_URL' AND "sourceUrl" IS NOT NULL AND "youtubeId" IS NULL AND "audioAssetId" IS NULL));
ALTER TABLE "CommunityCharacterThemeSong" ADD CONSTRAINT "CommunityCharacterThemeSong_bounds" CHECK ("startSeconds" >= 0 AND ("endSeconds" IS NULL OR "endSeconds" > "startSeconds") AND "version" > 0), ADD CONSTRAINT "CommunityCharacterThemeSong_source" CHECK (("sourceType" = 'YOUTUBE' AND "youtubeId" IS NOT NULL AND "sourceUrl" IS NULL AND "audioAssetId" IS NULL) OR ("sourceType" = 'UPLOAD' AND "audioAssetId" IS NOT NULL AND "youtubeId" IS NULL AND "sourceUrl" IS NULL) OR ("sourceType" = 'AUDIO_URL' AND "sourceUrl" IS NOT NULL AND "youtubeId" IS NULL AND "audioAssetId" IS NULL));

COMMIT;
