-- Migration: Add `track` boolean column to `jobs` table
-- Adds `track` (optional boolean) with default false, backfills existing rows,
-- and creates a trigger to keep it in sync when `status` is inserted/updated.

BEGIN;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS track BOOLEAN DEFAULT false;

-- Backfill `track` for existing records where status is one of the listed values
UPDATE jobs
SET track = true
WHERE status IN (
  'AI Interview',
  'Email Enquiry',
  'Preliminary Call',
  'Interview',
  'Offer',
  'Rejected'
);

-- Create trigger function to set `track` based on `status` on insert/update
CREATE OR REPLACE FUNCTION jobs_set_track_based_on_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS NOT NULL AND lower(NEW.status) IN (
      'ai interview',
      'email enquiry',
      'preliminary call',
      'interview',
      'offer',
      'rejected'
    ) THEN
    NEW.track = true;
  ELSE
    NEW.track = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_track_on_status ON jobs;
CREATE TRIGGER set_track_on_status
BEFORE INSERT OR UPDATE ON jobs
FOR EACH ROW
EXECUTE PROCEDURE jobs_set_track_based_on_status();

COMMIT;

-- Rollback notes (manual):
-- DROP TRIGGER IF EXISTS set_track_on_status ON jobs;
-- DROP FUNCTION IF EXISTS jobs_set_track_based_on_status();
-- ALTER TABLE jobs DROP COLUMN IF EXISTS track;