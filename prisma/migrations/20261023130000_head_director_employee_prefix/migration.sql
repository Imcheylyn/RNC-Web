-- Preserve the issued registration number and all other segments of existing Head Director IDs.
UPDATE "CommunityCharacter"
SET "employeeId" = 'PR' || SUBSTRING("employeeId" FROM 3),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "characterType" = 'HeadDirector'
  AND "employeeNumber" IS NOT NULL
  AND "employeeId" ~ '^[A-Z]{2} [0-9]{4} [0-9]{4} [A-Z]{2}$'
  AND "employeeId" NOT LIKE 'PR %';
