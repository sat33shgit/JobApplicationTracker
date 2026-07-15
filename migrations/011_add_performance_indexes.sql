-- Performance indexes for the hot query paths

-- GET /api/jobs -> SELECT * FROM jobs ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs (created_at DESC);

-- attachment lookups/deletes by job -> SELECT/DELETE FROM attachments WHERE job_id = $1
CREATE INDEX IF NOT EXISTS idx_attachments_job_id ON attachments (job_id);

-- notes by job (FK has no automatic index in Postgres)
CREATE INDEX IF NOT EXISTS idx_notes_job_id ON notes (job_id);

-- question lists ordered by created_at
CREATE INDEX IF NOT EXISTS idx_interview_questions_created_at ON interview_questions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interviewer_questions_created_at ON interviewer_questions (created_at DESC);
