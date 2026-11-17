-- Magus has a fixed red seven-star treatment; Head Director keeps its native rainbow frame artwork.
UPDATE "CommunityFrameStyle"
SET "borderColor" = '#d1373f', "glowColor" = '#f43843', "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'star7-magus';
