UPDATE "CommunityEmployeeCounter"
SET "value" = GREATEST(
  "value",
  COALESCE((SELECT MAX("employeeNumber") FROM "CommunityCharacter"), 0)
)
WHERE "id" = 'main';
