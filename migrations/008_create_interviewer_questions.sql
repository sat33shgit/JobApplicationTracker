-- Migration: Create `interviewer_questions` table
-- Columns:
-- id BIGSERIAL PRIMARY KEY
-- question TEXT NOT NULL
-- company TEXT
-- role TEXT
-- created_at TIMESTAMPTZ DEFAULT now()
-- updated_at TIMESTAMPTZ DEFAULT now()

BEGIN;

CREATE TABLE IF NOT EXISTS interviewer_questions (
  id BIGSERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  company TEXT,
  role TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS set_updated_at_on_interviewer_questions ON interviewer_questions;
CREATE TRIGGER set_updated_at_on_interviewer_questions
BEFORE UPDATE ON interviewer_questions
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

COMMIT;

-- Rollback notes (manual):
-- DROP TRIGGER IF EXISTS set_updated_at_on_interviewer_questions ON interviewer_questions;
-- DROP TABLE IF EXISTS interviewer_questions;
