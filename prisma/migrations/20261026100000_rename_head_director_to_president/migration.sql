ALTER TABLE "CommunityCharacter" DROP CONSTRAINT "CommunityCharacter_type_check";

ALTER TABLE "CommunityCharacter"
  ADD COLUMN "weaponName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "weaponDescription" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "weaponArcana" TEXT NOT NULL DEFAULT '';

UPDATE "CommunityCharacter"
SET "characterType" = 'President',
    "archiveCategory" = 'President',
    "position" = CASE WHEN "position" IN ('Head Director', 'HeadDirector') THEN 'President' ELSE "position" END
WHERE "characterType" IN ('HeadDirector', 'Head Director');

UPDATE "CommunityCharacter"
SET "archiveCategory" = 'President'
WHERE "archiveCategory" IN ('Head Director', 'HeadDirector');

ALTER TABLE "CommunityCharacter" ADD CONSTRAINT "CommunityCharacter_type_check"
CHECK ("characterType" IN ('Character','Human','President','Director','NPC','Magus','Monster'));

ALTER TABLE "CommunityFrameStyle" DROP CONSTRAINT "CommunityFrameStyle_key_check";
UPDATE "CommunityFrameStyle" SET "key" = 'star7-president' WHERE "key" = 'star7-director';
ALTER TABLE "CommunityFrameStyle" ADD CONSTRAINT "CommunityFrameStyle_key_check"
CHECK ("key" IN ('star7-magus','star7-president','arcana-natural','arcana-beast','arcana-plant','arcana-star','arcana-mineral','arcana-spirit','arcana-intellect'));