-- Initial schema for Job Applications Tracker
-- Jobs, notes, tags, and job_tags

CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT,
  status TEXT DEFAULT 'applied',
  stage TEXT,
  applied_date DATE,
  url TEXT,
  location TEXT,
  salary TEXT,
  metadata JSONB,
  status_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notes (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT REFERENCES jobs(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS job_tags (
  job_id BIGINT REFERENCES jobs(id) ON DELETE CASCADE,
  tag_id BIGINT REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (job_id, tag_id)
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_updated_at ON jobs;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON jobs
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- Attachments (files saved to blob or local storage)
CREATE TABLE IF NOT EXISTS attachments (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  storage_key TEXT,
  url TEXT,
  size BIGINT,
  content_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
