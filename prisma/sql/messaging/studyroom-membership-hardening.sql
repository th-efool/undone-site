BEGIN;
ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS "publicGoal" text;
CREATE UNIQUE INDEX IF NOT EXISTS room_create_intent_key ON room_audit_logs ("actorId","clientRequestId") WHERE action='ROOM_CREATED' AND "clientRequestId" IS NOT NULL;
UPDATE study_rooms SET listing='LISTED' WHERE listing='PUBLIC';
COMMIT;
