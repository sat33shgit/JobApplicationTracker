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
    const hasR2 = process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET;
    if (url && storageKey) {
      // Prefer any URL returned by the client/provider. If none, and R2 is configured
      // try to construct a public URL from R2 endpoint or public prefix.
      let urlToSave = url || null;
      if (!urlToSave && hasR2) {
        const publicPrefix = process.env.R2_PUBLIC_URL_PREFIX || process.env.R2_ENDPOINT;
        if (publicPrefix) {
          const prefix = publicPrefix.replace(/\/+$/, '');
          urlToSave = `${prefix}/${process.env.R2_BUCKET}/${encodeURIComponent(storageKey || filename)}`;
        }
      }
      const result = await db.query(
        `INSERT INTO attachments(job_id, filename, storage_key, url, size, content_type) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [jobId || null, filename, storageKey, urlToSave, size || null, contentType || null]
      );
      return res.status(201).json(result.rows[0]);
    }

    // Otherwise expect contentBase64
    const { jobId: _jobId, filename: _filename, contentBase64: _contentBase64, contentType: _contentType } = req.body;
    if (!_filename || !_contentBase64) return res.status(400).json({ error: 'filename and contentBase64 required' });
    const buffer = Buffer.from(_contentBase64, 'base64');

    // Create a DB record first so we can use its id as part of the storage key/path in R2.
    let inserted;
    try {
      const insertRes = await db.query(
        `INSERT INTO attachments(job_id, filename, storage_key, url, size, content_type) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [jobId || null, _filename, null, null, null, _contentType || null]
      );
      inserted = insertRes.rows[0];
    } catch (err) {
      console.error('failed to insert attachments row before upload', err && err.message);
      return res.status(500).json({ error: 'db insert failed' });
    }

    // Construct a storage filename/key that includes the attachment id so files are grouped by record.
    const storageFilename = `${inserted.id}/${_filename}`;

    let saved;
    try {
      // If client provided an uploadUrl (signed URL), pass it through so server can PUT bytes server-side.
      // Prefer using the storageFilename as the key when saving to R2/local providers.
      saved = await blob.save({ filename: storageFilename, buffer, contentType: _contentType, uploadUrl });
    } catch (err) {
      console.error('blob.save failed:', err && err.message);
      // Attempt to clean up the DB row we created to avoid orphaned records
      try { await db.query('DELETE FROM attachments WHERE id=$1', [inserted.id]); } catch (e) { console.warn('failed to delete attachment row after save error', e && e.message); }
      return res.status(502).json({ error: 'remote upload failed', detail: err && err.message });
    }

    // Prefer saved.url if available. If R2 is configured but saved.url is null,
    // attempt to construct a public URL using R2 endpoint or public prefix.
    let urlToSave = saved.url || null;
    if (!urlToSave) {
      const hasR2cfg = process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET;
      if (hasR2cfg) {
        const publicPrefix = process.env.R2_PUBLIC_URL_PREFIX || process.env.R2_ENDPOINT;
        if (publicPrefix) {
          const prefix = publicPrefix.replace(/\/+$/, '');
          urlToSave = `${prefix}/${process.env.R2_BUCKET}/${encodeURIComponent(saved.key || storageFilename)}`;
        }
      }
    }
    try {
      const upd = await db.query(
        `UPDATE attachments SET storage_key=$1, url=$2, size=$3, content_type=$4 WHERE id=$5 RETURNING *`,
        [saved.key || storageFilename, urlToSave, saved.size || buffer.length, _contentType || null, inserted.id]
      );
      res.status(201).json(upd.rows[0]);
    } catch (err) {
      console.error('failed to update attachment row after upload', err && err.message);
      return res.status(500).json({ error: 'db update failed' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'upload failed' });
  }
};
