-- Migration: Add `interview_sub_status` column to `jobs` table
-- Stores the selected sub-status when main status is "Interview".

BEGIN;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS interview_sub_status TEXT;

COMMIT;

