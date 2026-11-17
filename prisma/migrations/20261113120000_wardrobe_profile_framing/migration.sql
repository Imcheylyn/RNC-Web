-- Leave existing outfits on their original scale-only profile framing.
ALTER TABLE "CommunityCharacterSkin" ADD COLUMN "applyFramingToProfile" BOOLEAN;

-- New outfits use their wardrobe framing in the wardrobe only by default.
ALTER TABLE "CommunityCharacterSkin" ALTER COLUMN "applyFramingToProfile" SET DEFAULT false;
