ALTER TABLE "CommunityCharacter"
  ADD COLUMN "nationalityCode" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "employeeEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "employeeNumber" INTEGER,
  ADD COLUMN "employeeId" TEXT;

CREATE UNIQUE INDEX "CommunityCharacter_employeeNumber_key" ON "CommunityCharacter"("employeeNumber");
CREATE UNIQUE INDEX "CommunityCharacter_employeeId_key" ON "CommunityCharacter"("employeeId");
ALTER TABLE "CommunityCharacter" ADD CONSTRAINT "CommunityCharacter_employeeNumber_range"
  CHECK ("employeeNumber" IS NULL OR "employeeNumber" BETWEEN 1 AND 9999);

CREATE TABLE "CommunityEmployeeCounter" (
  "id" TEXT NOT NULL DEFAULT 'main',
  "value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CommunityEmployeeCounter_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommunityEmployeeCounter_value_range" CHECK ("value" BETWEEN 0 AND 9999)
);
INSERT INTO "CommunityEmployeeCounter" ("id", "value") VALUES ('main', 0);
