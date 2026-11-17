-- Horizontal composition is metadata; the artwork file is never cropped.
ALTER TABLE "CommunityCharacterSkin"
ADD COLUMN "imageOffsetX" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "CommunityCharacterSkin"
ADD CONSTRAINT "CommunityCharacterSkin_imageOffsetX_check"
CHECK ("imageOffsetX" BETWEEN -100 AND 100);
