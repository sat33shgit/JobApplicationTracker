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
    // persist contacts in metadata by default; if the DB has a top-level `contacts` column
    // then also persist there. Checking information_schema is inexpensive and cached.
    let contacts = null;
    if (Array.isArray(req.body && req.body.contacts)) contacts = req.body.contacts;
    else if (metadata && Array.isArray(metadata.contacts)) contacts = metadata.contacts;
    // If running against a real Postgres pool, stringify JSON params to avoid type issues
    const usePool = !!db && !!db.pool;

    // simple process-local cache to avoid repeated information_schema queries
    if (typeof global.__has_jobs_contacts_col === 'undefined') global.__has_jobs_contacts_col = null;
    async function hasContactsColumn() {
      if (global.__has_jobs_contacts_col !== null) return global.__has_jobs_contacts_col;
      try {
        const r = await db.query("SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='contacts' LIMIT 1");
        global.__has_jobs_contacts_col = r.rowCount === 1;
      } catch (e) {
        global.__has_jobs_contacts_col = false;
      }
      return global.__has_jobs_contacts_col;
    }

    const colExists = contacts ? await hasContactsColumn() : false;

    if (contacts && colExists) {
      const insertFields = 'title, company, status, stage, applied_date, url, location, salary, metadata, contacts, status_notes';
      const insertValuesPlaceholders = '$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11';
      const params = [
        title,
        company,
        status || 'applied',
        stage,
        applied_date || null,
        url || null,
        location || null,
        salary || null,
        usePool ? (metadata ? JSON.stringify(metadata) : null) : (metadata || null),
        usePool ? JSON.stringify(contacts) : contacts,
        initialNote
      ];
      const result = await db.query(`INSERT INTO jobs(${insertFields}) VALUES(${insertValuesPlaceholders}) RETURNING *`, params);
      return res.status(201).json(result.rows[0]);
    }

    // Fallback: persist contacts inside metadata only (no top-level column)
    const result = await db.query(
      `INSERT INTO jobs(title, company, status, stage, applied_date, url, location, salary, metadata, status_notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        title,
        company,
        status || 'applied',
        stage,
        applied_date || null,
        url || null,
        location || null,
        salary || null,
        usePool ? (metadata ? JSON.stringify(metadata) : null) : (metadata || null),
        initialNote
      ]
    );
    res.status(201).json(result.rows[0]);
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
    const urlToSave = (process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET) ? null : saved.url;
    const result = await db.query(
      `INSERT INTO attachments(job_id, filename, storage_key, url, size, content_type) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [jobId || null, filename, saved.key, urlToSave, saved.size, contentType || null]
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
