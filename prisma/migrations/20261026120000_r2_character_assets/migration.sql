ALTER TABLE "CommunityCharacterAsset"
  ALTER COLUMN "data" DROP NOT NULL,
  ADD COLUMN "storageBucket" TEXT,
  ADD COLUMN "storageKey" TEXT;
