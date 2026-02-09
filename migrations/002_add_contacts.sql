-- Migration: Add `contacts` JSONB column to `jobs` table
-- Adds a top-level column to store an array of contact objects for each job.

BEGIN;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS contacts JSONB;

-- Backfill `contacts` from existing metadata if present
UPDATE jobs
SET contacts = metadata->'contacts'
WHERE metadata IS NOT NULL AND (metadata->'contacts') IS NOT NULL;

COMMIT;

-- Rollback (if needed):
-- ALTER TABLE jobs DROP COLUMN IF EXISTS contacts;
