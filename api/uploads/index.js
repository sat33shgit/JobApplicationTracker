const db = require('../db');
const blob = require('../blob');

// POST /api/uploads
// Body JSON: { jobId, filename, contentBase64, contentType }
module.exports = async function (req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { jobId, filename, contentBase64, contentType } = req.body;
    if (!filename || !contentBase64) return res.status(400).json({ error: 'filename and contentBase64 required' });
    const buffer = Buffer.from(contentBase64, 'base64');
    const saved = await blob.save({ filename, buffer, contentType });
    const result = await db.query(
      `INSERT INTO attachments(job_id, filename, storage_key, url, size, content_type) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [jobId || null, filename, saved.key, saved.url, saved.size, contentType || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'upload failed' });
  }
};
