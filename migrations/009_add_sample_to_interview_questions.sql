-- Migration: Add `sample` boolean column to `interview_questions` table

BEGIN;

ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS sample BOOLEAN DEFAULT false;

COMMIT;

-- Rollback (manual):
-- ALTER TABLE interview_questions DROP COLUMN IF EXISTS sample;