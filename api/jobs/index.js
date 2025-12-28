const db = require('../db');

async function listJobs(req, res) {
  try {
    const result = await db.query('SELECT * FROM jobs ORDER BY created_at DESC');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
}

async function createJob(req, res) {
  try {
    const { title, company, status, stage, applied_date, url, location, salary, metadata } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    // Build initial status_notes entry: date-only in DD-MMM-YYYY, status on same line, notes on next line
    const _d = new Date();
    const dateOnly = `${String(_d.getDate()).padStart(2,'0')}-${_d.toLocaleString('en-US',{month:'short'})}-${_d.getFullYear()}`;
    const initialNote = `${dateOnly} | ${status || 'applied'}\n${(metadata && metadata.notes) ? metadata.notes : ''}`;
    const result = await db.query(
      `INSERT INTO jobs(title, company, status, stage, applied_date, url, location, salary, metadata, status_notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [title, company, status || 'applied', stage, applied_date || null, url || null, location || null, salary || null, metadata || null, initialNote]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createJob error:', err && err.message);
    if (err && err.stack) console.error(err.stack);
    // include request body in non-production to aid debugging (do not leak in prod)
    if (process.env.NODE_ENV !== 'production') console.error('createJob body:', req.body);
    res.status(500).json({ error: 'Failed to create job', detail: process.env.NODE_ENV === 'production' ? undefined : (err && err.message) });
  }
}

// Attach a file to a job via base64 payload
async function uploadAttachment(req, res) {
  try {
    const { jobId, filename, contentBase64, contentType } = req.body;
    if (!filename || !contentBase64) return res.status(400).json({ error: 'filename and contentBase64 required' });
    const buffer = Buffer.from(contentBase64, 'base64');
    const blob = require('../blob');
    const saved = await blob.save({ filename, buffer, contentType });
    const result = await db.query(
      `INSERT INTO attachments(job_id, filename, storage_key, url, size, content_type) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [jobId || null, filename, saved.key, saved.url, saved.size, contentType || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
}

module.exports = async function (req, res) {
  if (req.method === 'GET') return listJobs(req, res);
  if (req.method === 'POST') return createJob(req, res);
  res.setHeader('Allow', 'GET, POST');
  res.status(405).end('Method Not Allowed');
};
