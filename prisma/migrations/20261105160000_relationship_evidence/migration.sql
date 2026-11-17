-- Additive evidence records; all existing relationship notes are retained.
BEGIN;
CREATE TABLE "CommunityRelationshipEvidence" (
 "id" TEXT NOT NULL,
 "relationshipId" TEXT NOT NULL,
 "title" TEXT NOT NULL DEFAULT '',
 "text" TEXT NOT NULL DEFAULT '',
 "imageAssetId" TEXT,
 "sortOrder" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CommunityRelationshipEvidence_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "RelationshipEvidence_content" CHECK ("title" <> '' OR "text" <> '' OR "imageAssetId" IS NOT NULL),
 CONSTRAINT "RelationshipEvidence_order" CHECK ("sortOrder" >= 0)
);
CREATE INDEX "CommunityRelationshipEvidence_relationshipId_sortOrder_createdAt_idx" ON "CommunityRelationshipEvidence"("relationshipId", "sortOrder", "createdAt");
CREATE INDEX "CommunityRelationshipEvidence_imageAssetId_idx" ON "CommunityRelationshipEvidence"("imageAssetId");
ALTER TABLE "CommunityRelationshipEvidence" ADD CONSTRAINT "CommunityRelationshipEvidence_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "CommunityCharacterRelationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityRelationshipEvidence" ADD CONSTRAINT "CommunityRelationshipEvidence_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "CommunityMediaAsset"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
COMMIT;
