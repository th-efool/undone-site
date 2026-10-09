-- Apply after creation-durability.sql. Tombstones prevent access during two-store cleanup.
ALTER TABLE "creation_drafts" ADD COLUMN "expiredAt" TIMESTAMP(3);
