ALTER TABLE "CommunityCharacter" DROP CONSTRAINT "CommunityCharacter_ownerId_fkey";
ALTER TABLE "CommunityCharacter" ALTER COLUMN "ownerId" DROP NOT NULL;
ALTER TABLE "CommunityCharacter" ADD CONSTRAINT "CommunityCharacter_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CommunityUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunityCharacter"
  ADD COLUMN "characterType" TEXT NOT NULL DEFAULT 'Character',
  ADD COLUMN "publicationState" TEXT NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "reviewNote" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);
UPDATE "CommunityCharacter" SET "createdById" = "ownerId", "characterType" = CASE
  WHEN "archiveCategory" IN ('Head Director', 'HeadDirector') THEN 'HeadDirector'
  WHEN "archiveCategory" IN ('Director', 'NPC', 'Magus', 'Monster') THEN "archiveCategory"
  WHEN "race" = 'Human' THEN 'Human' ELSE 'Character' END;
CREATE INDEX "CommunityCharacter_publicationState_updatedAt_idx" ON "CommunityCharacter"("publicationState", "updatedAt");
CREATE INDEX "CommunityCharacter_characterType_idx" ON "CommunityCharacter"("characterType");
ALTER TABLE "CommunityCharacter" ADD CONSTRAINT "CommunityCharacter_type_check" CHECK ("characterType" IN ('Character','Human','HeadDirector','Director','NPC','Magus','Monster'));
ALTER TABLE "CommunityCharacter" ADD CONSTRAINT "CommunityCharacter_state_check" CHECK ("publicationState" IN ('DRAFT','PENDING','PUBLISHED','CHANGES_REQUESTED','ARCHIVED'));

CREATE TABLE "CommunitySettings" (
  "id" TEXT PRIMARY KEY DEFAULT 'main', "name" TEXT NOT NULL DEFAULT 'Reverse : Noir Chronicle',
  "state" TEXT NOT NULL DEFAULT 'OPEN', "opensAt" TIMESTAMP(3), "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
  "headline" TEXT NOT NULL DEFAULT '', "description" TEXT NOT NULL DEFAULT '', "worldUrl" TEXT NOT NULL DEFAULT '',
  "updatedById" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunitySettings_state_check" CHECK ("state" IN ('OPEN','CLOSED','PAUSED'))
);
INSERT INTO "CommunitySettings" ("id") VALUES ('main');
CREATE TABLE "CommunityAnnouncement" (
  "id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "body" TEXT NOT NULL, "kind" TEXT NOT NULL DEFAULT 'NOTICE',
  "state" TEXT NOT NULL DEFAULT 'DRAFT', "publishAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "pinned" BOOLEAN NOT NULL DEFAULT false,
  "authorId" TEXT NOT NULL, "updatedById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunityAnnouncement_state_check" CHECK ("state" IN ('DRAFT','PUBLISHED','ARCHIVED'))
);
CREATE INDEX "CommunityAnnouncement_state_publishAt_expiresAt_idx" ON "CommunityAnnouncement"("state","publishAt","expiresAt");
CREATE TABLE "CommunityRole" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL UNIQUE, "description" TEXT NOT NULL DEFAULT '', "color" TEXT NOT NULL DEFAULT '#d99468',
  "sortOrder" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "CommunityCharacterRole" (
  "characterId" TEXT NOT NULL REFERENCES "CommunityCharacter"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "roleId" TEXT NOT NULL REFERENCES "CommunityRole"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("characterId","roleId")
);
CREATE INDEX "CommunityCharacterRole_roleId_idx" ON "CommunityCharacterRole"("roleId");
CREATE TABLE "CommunityRankStyle" (
  "rank" INTEGER PRIMARY KEY, "borderColor" TEXT NOT NULL, "glowColor" TEXT NOT NULL, "accentColor" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CommunityRankStyle_rank_check" CHECK ("rank" BETWEEN 1 AND 6)
);
INSERT INTO "CommunityRankStyle" ("rank","borderColor","glowColor","accentColor") VALUES
 (1,'#77716b','#77716b','#d0c3b8'), (2,'#719c84','#719c84','#c2e2cf'), (3,'#6c9ec4','#6c9ec4','#c0ddf2'),
 (4,'#a47bc0','#9d69ba','#dfc8ed'), (5,'#e1bd58','#dab040','#f3e1a7'), (6,'#e78c48','#de702f','#ffd3b3');
CREATE TABLE "CommunityAuditLog" (
  "id" TEXT PRIMARY KEY, "actorId" TEXT NOT NULL, "actorDiscordId" TEXT NOT NULL, "actorName" TEXT NOT NULL,
  "action" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "summary" TEXT NOT NULL,
  "before" JSONB, "after" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CommunityAuditLog_createdAt_idx" ON "CommunityAuditLog"("createdAt");
CREATE INDEX "CommunityAuditLog_entityType_entityId_idx" ON "CommunityAuditLog"("entityType","entityId");
