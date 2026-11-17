-- Add the evidence image purpose while retaining existing status and size validation.
BEGIN;
ALTER TABLE "CommunityMediaAsset" DROP CONSTRAINT "Media_purpose_status_size";
ALTER TABLE "CommunityMediaAsset" ADD CONSTRAINT "Media_purpose_status_size" CHECK ("purpose" IN ('AUDIO','COVER','EVIDENCE') AND "status" IN ('PENDING','READY') AND "byteSize" > 0);
COMMIT;
