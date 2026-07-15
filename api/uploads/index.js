const db = require('../../lib/server/db');
const blob = require('../../lib/server/blob');
const { sanitizeFilename, isSafeStorageKey } = require('../../lib/server/request-utils');

// Max upload size (base64-decoded): 15 MB
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

// POST /api/uploads
// Body JSON: { jobId, filename, contentBase64, contentType }
module.exports = async function (req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    // Helper: construct a public URL from a prefix, bucket and object key.
    function buildR2Url(prefix, bucket, key) {
      if (!prefix) return null;
      const trimmed = prefix.replace(/\/+$/, '');
      // If prefix already includes the bucket, don't add it again.
      const hasBucket = bucket && trimmed.indexOf('/' + bucket) !== -1;
      const parts = [trimmed];
      if (bucket && !hasBucket) parts.push(bucket);
      // Split key into segments and encode each segment (preserve path separators)
      const segments = (key || '').split('/').map(s => encodeURIComponent(s));
      return parts.concat(segments).join('/');
    }

    // NOTE: `uploadUrl` is intentionally NOT read from the client anymore.
    // Accepting a client-supplied upload URL let callers make the server PUT
    // data to an arbitrary URL (SSRF).
    const { jobId, filename, contentBase64, contentType, url, storageKey, size } = req.body || {};

    // Validate jobId if provided
    if (jobId !== undefined && jobId !== null && !/^\d+$/.test(String(jobId))) {
      return res.status(400).json({ error: 'invalid jobId' });
    }

    // If client already uploaded the bytes to a signed URL and sends metadata (url/storageKey), insert directly
    const hasR2 = process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET;
    if (url && storageKey) {
      if (!isSafeStorageKey(storageKey)) return res.status(400).json({ error: 'invalid storageKey' });
      // Prefer any URL returned by the client/provider. If none, and R2 is configured
      // try to construct a public URL from R2 endpoint or public prefix.
      let urlToSave = url || null;
      if (!urlToSave && hasR2) {
        const publicPrefix = process.env.R2_PUBLIC_URL_PREFIX || process.env.R2_ENDPOINT;
        if (publicPrefix) {
          urlToSave = buildR2Url(publicPrefix, process.env.R2_BUCKET, storageKey || filename);
        }
      }
      const result = await db.query(
        `INSERT INTO attachments(job_id, filename, storage_key, url, size, content_type) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
        [jobId || null, filename, storageKey, urlToSave, size || null, contentType || null]
      );
      return res.status(201).json(result.rows[0]);
    }

    // Otherwise expect contentBase64
    const { filename: _rawFilename, contentBase64: _contentBase64, contentType: _contentType } = req.body || {};
    if (!_rawFilename || !_contentBase64) return res.status(400).json({ error: 'filename and contentBase64 required' });
    // Sanitize filename to prevent path traversal into arbitrary directories
    const _filename = sanitizeFilename(_rawFilename);
    if (!_filename) return res.status(400).json({ error: 'invalid filename' });
    if (typeof _contentBase64 !== 'string' || _contentBase64.length > Math.ceil(MAX_UPLOAD_BYTES * 4 / 3) + 4) {
      return res.status(413).json({ error: 'file too large' });
    }
    const buffer = Buffer.from(_contentBase64, 'base64');
    if (buffer.length > MAX_UPLOAD_BYTES) return res.status(413).json({ error: 'file too large' });

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

    // Construct a storage filename/key that includes the job id so all files for one application are grouped together.
    // Use jobId as the folder name, or fall back to attachment id if jobId is not provided.
    const folderName = jobId || inserted.id;
    const storageFilename = `${folderName}/${_filename}`;

    let saved;
    try {
      // Prefer using the storageFilename as the key when saving to R2/local providers.
      saved = await blob.save({ filename: storageFilename, buffer, contentType: _contentType });
    } catch (err) {
      console.error('blob.save failed:', err && err.message);
      // Attempt to clean up the DB row we created to avoid orphaned records
      try { await db.query('DELETE FROM attachments WHERE id=$1', [inserted.id]); } catch (e) { if (process.env.NODE_ENV !== 'production') console.warn('failed to delete attachment row after save error', e && e.message); }
      return res.status(502).json({ error: 'remote upload failed' });
    }

    // Prefer saved.url if available. If R2 is configured but saved.url is null,
    // attempt to construct a public URL using R2 endpoint or public prefix.
    // Prefer a constructed R2 URL based on the saved.key when R2 is configured —
    // `saved.url` may contain encoded slashes (%2F) which can cause gateway issues.
    let urlToSave = null;
    const hasR2cfg = process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET;
    if (hasR2cfg) {
      const publicPrefix = process.env.R2_PUBLIC_URL_PREFIX || process.env.R2_ENDPOINT;
      if (publicPrefix) {
        urlToSave = buildR2Url(publicPrefix, process.env.R2_BUCKET, saved.key || storageFilename);
      }
    }
    // Fallback to any provider-returned URL if we couldn't construct one
    if (!urlToSave) urlToSave = saved.url || null;
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
