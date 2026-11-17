-- Store display zoom separately; existing artwork and metadata stay unchanged.
ALTER TABLE "CommunityCharacterSkin"
ADD COLUMN "imageScale" INTEGER NOT NULL DEFAULT 100;

ALTER TABLE "CommunityCharacterSkin"
ADD CONSTRAINT "CommunityCharacterSkin_imageScale_check"
CHECK ("imageScale" BETWEEN 50 AND 200);
