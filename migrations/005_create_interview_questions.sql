-- Migration: Create `interview_questions` table
-- Columns:
-- id BIGSERIAL PRIMARY KEY
-- question TEXT NOT NULL
-- answer TEXT
-- category TEXT
-- created_at TIMESTAMPTZ DEFAULT now()
-- updated_at TIMESTAMPTZ DEFAULT now()

BEGIN;

CREATE TABLE IF NOT EXISTS interview_questions (
  id BIGSERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure the shared `update_updated_at_column` trigger function exists (created in earlier migrations)
-- Attach trigger to keep `updated_at` current
DROP TRIGGER IF EXISTS set_updated_at_on_interview_questions ON interview_questions;
CREATE TRIGGER set_updated_at_on_interview_questions
BEFORE UPDATE ON interview_questions
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

COMMIT;

-- Rollback notes (manual):
-- DROP TRIGGER IF EXISTS set_updated_at_on_interview_questions ON interview_questions;
-- DROP TABLE IF EXISTS interview_questions;
