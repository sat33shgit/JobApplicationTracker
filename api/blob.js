const fs = require('fs');
const path = require('path');

// Blob helper supporting two modes:
// - Local filesystem (default): writes to `public/uploads/` and returns a public URL path.
// - Remote provider: if `BLOB_PROVIDER=vercel` and `VERCEL_BLOB_UPLOAD_URL` is set, the helper
//   will `PUT` the raw bytes to that URL (caller must provide the full signed upload URL)
//   and expects the response JSON to contain `{ url, key }` or similar. This is intentionally
//   generic because different Vercel blob flows may provide different upload endpoints.

async function saveLocal(filename, buffer) {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, filename);
  await fs.promises.writeFile(filePath, buffer);
  return {
    url: `/uploads/${filename}`,
    key: `uploads/${filename}`,
    size: buffer.length,
  };
}

async function saveRemote(filename, buffer, opts = {}) {
  // EXPECTED ENV:
  // - VERCEL_BLOB_UPLOAD_URL: a full signed URL to PUT the file into (caller or env)
  // - VERCEL_BLOB_PUBLIC_URL_PREFIX (optional): prefix to build public URL
  const uploadUrl = opts.uploadUrl || process.env.VERCEL_BLOB_UPLOAD_URL;
  if (!uploadUrl) throw new Error('VERCEL_BLOB_UPLOAD_URL not provided for remote blob uploads');

  const headers = {
    'content-type': opts.contentType || 'application/octet-stream',
    'content-length': String(buffer.length),
  };

  // Use global fetch (available in modern Node / Vercel). If not available, user must supply uploadUrl
  const res = await fetch(uploadUrl, { method: 'PUT', headers, body: buffer });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Remote blob upload failed: ${res.status} ${text}`);
  }

  // Try to parse JSON response for a public URL or key; fall back to using a public prefix.
  let body = null;
  try { body = await res.json(); } catch (e) { /* not JSON */ }

  const publicPrefix = process.env.VERCEL_BLOB_PUBLIC_URL_PREFIX || opts.publicPrefix;
  const url = body && body.url ? body.url : (publicPrefix ? `${publicPrefix}/${filename}` : uploadUrl);

  return {
    url,
    key: body && body.key ? body.key : filename,
    size: buffer.length,
  };
}

module.exports = {
  async save({ filename, buffer, contentType, uploadUrl, publicPrefix }) {
    const provider = process.env.BLOB_PROVIDER || 'local';
    if (provider === 'vercel' || provider === 'remote') {
      return saveRemote(filename, buffer, { contentType, uploadUrl, publicPrefix });
    }
    return saveLocal(filename, buffer);
  }
};
