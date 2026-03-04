-- Migration: Add optional `company` column to `interview_questions`

BEGIN;

ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS company TEXT;

COMMIT;

-- Rollback notes (manual):
-- ALTER TABLE interview_questions DROP COLUMN IF EXISTS company;
