-- Migration: Add optional `role` column to interview_questions

BEGIN;

ALTER TABLE interview_questions
  ADD COLUMN IF NOT EXISTS role TEXT;

COMMIT;

-- Rollback (manual):
-- ALTER TABLE interview_questions DROP COLUMN IF EXISTS role;
