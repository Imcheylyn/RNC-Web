UPDATE "CommunityCharacter"
SET "publicationState" = 'PUBLISHED',
    "reviewNote" = '',
    "reviewedById" = NULL,
    "reviewedAt" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "publicationState" IN ('PENDING', 'CHANGES_REQUESTED');