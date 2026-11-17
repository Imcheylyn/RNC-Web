-- Store vertical positioning without changing the full source artwork.
ALTER TABLE "CommunityCharacterSkin"
ADD COLUMN "imageOffsetY" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "CommunityCharacterSkin"
ADD CONSTRAINT "CommunityCharacterSkin_imageOffsetY_check"
CHECK ("imageOffsetY" BETWEEN -100 AND 100);
