CREATE TABLE "CommunityFrameStyle" (
  "key" TEXT PRIMARY KEY,
  "borderColor" TEXT NOT NULL,
  "glowColor" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityFrameStyle_key_check" CHECK ("key" IN ('star7-magus','star7-director','arcana-natural','arcana-beast','arcana-plant','arcana-star','arcana-mineral','arcana-spirit','arcana-intellect')),
  CONSTRAINT "CommunityFrameStyle_borderColor_check" CHECK ("borderColor" ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT "CommunityFrameStyle_glowColor_check" CHECK ("glowColor" ~ '^#[0-9a-fA-F]{6}$')
);
-- Element colours replace the legacy rank palette. Existing character data is unchanged.
INSERT INTO "CommunityFrameStyle" ("key", "borderColor", "glowColor") VALUES
 ('star7-magus','#ba624e','#ba624e'), ('star7-director','#b9a8c9','#b9a8c9'),
 ('arcana-natural','#8a8187','#8a8187'), ('arcana-beast','#ae2b33','#ae2b33'),
 ('arcana-plant','#23703c','#23703c'), ('arcana-star','#3b6fa5','#3b6fa5'),
 ('arcana-mineral','#815e32','#815e32'), ('arcana-spirit','#783981','#783981'),
 ('arcana-intellect','#897a30','#897a30');
