-- Migration: Add `interview_date` DATE column to `jobs` table
-- Optional field to store interview date for an application

BEGIN;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS interview_date DATE;

COMMIT;

-- Rollback (manual):
-- ALTER TABLE jobs DROP COLUMN IF EXISTS interview_date;
