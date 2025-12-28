const db = require('../db');
const blob = require('../blob');
const fs = require('fs');
const path = require('path');

// POST /api/uploads
// Body JSON: { jobId, filename, contentBase64, contentType }
module.exports = async function (req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { jobId, filename, contentBase64, contentType, url, storageKey, size, uploadUrl } = req.body;

    // If client already uploaded the bytes to a signed URL and sends metadata (url/storageKey), insert directly
    if (url && storageKey) {
      const result = await db.query(
        `INSERT INTO attachments(job_id, filename, storage_key, url, size, content_type) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [jobId || null, filename, storageKey, url, size || null, contentType || null]
      );
      return res.status(201).json(result.rows[0]);
    }

    // Otherwise expect contentBase64
    const { jobId: _jobId, filename: _filename, contentBase64: _contentBase64, contentType: _contentType } = req.body;
    if (!_filename || !_contentBase64) return res.status(400).json({ error: 'filename and contentBase64 required' });
    const buffer = Buffer.from(_contentBase64, 'base64');
    let saved;
    try {
      // If client provided an uploadUrl (signed URL), pass it through so server can PUT bytes server-side.
      saved = await blob.save({ filename: _filename, buffer, contentType: _contentType, uploadUrl });
    } catch (err) {
      console.error('blob.save failed:', err && err.message);
      return res.status(502).json({ error: 'remote upload failed', detail: err && err.message });
    }

    const result = await db.query(
      `INSERT INTO attachments(job_id, filename, storage_key, url, size, content_type) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [jobId || null, _filename, saved.key, saved.url, saved.size, _contentType || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'upload failed' });
  }
};
