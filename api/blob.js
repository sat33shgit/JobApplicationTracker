const fs = require('fs');
const path = require('path');
let S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, getSignedUrl;
try {
  // AWS SDK v3 (used for Cloudflare R2 S3-compatible API)
  ({ S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3'));
  ({ getSignedUrl } = require('@aws-sdk/s3-request-presigner'));
} catch (e) {
  // dependencies may not be installed in some envs; feature will be unavailable until installed
}

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
  // If a public URL prefix for Vercel blob storage is configured, expose the public URL
  const publicPrefix = process.env.VERCEL_BLOB_PUBLIC_URL_PREFIX;
  if (publicPrefix) {
    const prefix = publicPrefix.replace(/\/+$/, '');
    const encoded = encodeURIComponent(filename);
    return {
      url: `${prefix}/${encoded}`,
      key: filename,
      size: buffer.length,
    };
  }

  return {
    url: `/uploads/${filename}`,
    key: `uploads/${filename}`,
    size: buffer.length,
  };
}

function getR2Client() {
  if (!S3Client) return null;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accessKeyId || !secretAccessKey || !bucket) return null;
  const endpoint = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);
  const region = process.env.R2_REGION || 'auto';
  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });
  return client;
}

async function saveR2(filename, buffer, opts = {}) {
  const client = getR2Client();
  if (!client) throw new Error('R2 client not configured (missing R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET)');
  const bucket = process.env.R2_BUCKET;
  const contentType = opts.contentType || 'application/octet-stream';
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: filename, Body: buffer, ContentType: contentType });
  await client.send(cmd);
  const publicPrefix = process.env.R2_PUBLIC_URL_PREFIX || opts.publicPrefix;
  if (publicPrefix) {
    const prefix = publicPrefix.replace(/\/+$/, '');
    const encoded = encodeURIComponent(filename);
    return { url: `${prefix}/${encoded}`, key: filename, size: buffer.length };
  }
  // If no public prefix, return an R2-style key and endpoint info
  const endpoint = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : null);
  const url = endpoint ? `${endpoint}/${bucket}/${encodeURIComponent(filename)}` : null;
  return { url, key: filename, size: buffer.length };
}

async function saveRemote(filename, buffer, opts = {}) {
  // EXPECTED ENV / options:
  // - VERCEL_BLOB_UPLOAD_URL: a full signed URL to PUT the file into (caller or env)
  // - VERCEL_BLOB_PUBLIC_URL_PREFIX (optional): prefix to build public URL
  // - BLOB_READ_WRITE_TOKEN: bearer token to create signed upload URLs via Vercel API

  // If caller provided an explicit signed upload URL, prefer it.
  let uploadUrl = opts.uploadUrl || process.env.VERCEL_BLOB_UPLOAD_URL;

  const headers = {
    'content-type': opts.contentType || 'application/octet-stream',
    'content-length': String(buffer.length),
  };

  // If we don't have a signed upload URL, but a read/write token exists, request one from Vercel.
  const rwToken = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  // By default do not enforce remote uploads. Set ENFORCE_REMOTE_UPLOADS=true to make
  // missing or failing remote operations raise errors instead of falling back to local storage.
  const enforce = (process.env.ENFORCE_REMOTE_UPLOADS || 'false') === 'true';
  if (!uploadUrl && rwToken) {
    const createUrl = 'https://api.vercel.com/v1/blob';
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${rwToken}`
      },
      body: JSON.stringify({ name: filename })
    });
    if (!createRes.ok) {
      const txt = await createRes.text().catch(()=>'<no body>');
      const msg = `Vercel blob create failed: ${createRes.status} ${txt}`;
      if (enforce) throw new Error(msg);
      // fallback: if public prefix configured, return that as url/key; otherwise fall through to local save
      const publicPrefix = process.env.VERCEL_BLOB_PUBLIC_URL_PREFIX;
      if (publicPrefix) {
        const prefix = publicPrefix.replace(/\/+$/, '');
        const encoded = encodeURIComponent(filename);
        return { uploadURL: null, url: `${prefix}/${encoded}`, key: filename, fallback: true };
      }
      // if not enforcing and no public prefix, continue and allow caller to handle local save
      return saveLocal(filename, buffer);
    }
    const createBody = await createRes.json().catch(() => null);
    // Common response fields: uploadURL / uploadUrl / url
    uploadUrl = createBody?.uploadURL || createBody?.uploadUrl || createBody?.url || createBody?.signedUrl || null;
    if (!uploadUrl && createBody && createBody.url) uploadUrl = createBody.url;
    if (!uploadUrl) throw new Error('Vercel blob create response did not contain an upload URL');
  }

  if (!uploadUrl) {
    const msg = 'No upload URL available for remote blob uploads';
    if (enforce) throw new Error(msg);
    const publicPrefix = process.env.VERCEL_BLOB_PUBLIC_URL_PREFIX;
    if (publicPrefix) {
      const prefix = publicPrefix.replace(/\/+$/, '');
      const encoded = encodeURIComponent(filename);
      return { uploadURL: null, url: `${prefix}/${encoded}`, key: filename, fallback: true };
    }
    return saveLocal(filename, buffer);
  }

  // Upload bytes via PUT to the signed URL
  let res;
  try {
    res = await fetch(uploadUrl, { method: 'PUT', headers, body: buffer });
  } catch (fetchErr) {
    const msg = 'PUT to uploadUrl failed: ' + (fetchErr && fetchErr.message);
    if (enforce) throw new Error(msg);
    // fallback
    const publicPrefix = process.env.VERCEL_BLOB_PUBLIC_URL_PREFIX;
    if (publicPrefix) {
      const prefix = publicPrefix.replace(/\/+$/, '');
      const encoded = encodeURIComponent(filename);
      return { uploadURL: null, url: `${prefix}/${encoded}`, key: filename, fallback: true };
    }
    return saveLocal(filename, buffer);
  }
  if (!res.ok) {
    const text = await res.text().catch(()=>'<no body>');
    const msg = `Remote blob upload failed: ${res.status} ${text}`;
    if (enforce) throw new Error(msg);
    const publicPrefix = process.env.VERCEL_BLOB_PUBLIC_URL_PREFIX;
    if (publicPrefix) {
      const prefix = publicPrefix.replace(/\/+$/, '');
      const encoded = encodeURIComponent(filename);
      return { uploadURL: null, url: `${prefix}/${encoded}`, key: filename, fallback: true };
    }
    return saveLocal(filename, buffer);
  }

  // Try to read JSON body returned by PUT (some endpoints may return metadata); otherwise derive URL
  let putBody = null;
  try { putBody = await res.json(); } catch (e) { /* not JSON */ }

  const publicPrefix = process.env.VERCEL_BLOB_PUBLIC_URL_PREFIX || opts.publicPrefix;
  const url = putBody && putBody.url ? putBody.url : (publicPrefix ? `${publicPrefix}/${filename}` : uploadUrl);

  return {
    url,
    key: putBody && putBody.key ? putBody.key : filename,
    size: buffer.length,
  };
}

// Create signed upload URL using Cloudflare R2 (S3-compatible) if configured
async function createSignedUrlR2(filename, opts = {}) {
  const client = getR2Client();
  if (!client || !getSignedUrl) return null;
  const bucket = process.env.R2_BUCKET;
  const expires = opts.expires || 900; // 15 minutes
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: filename, ContentType: opts.contentType || 'application/octet-stream' });
  const signed = await getSignedUrl(client, cmd, { expiresIn: expires });
  const publicPrefix = process.env.R2_PUBLIC_URL_PREFIX;
  const url = publicPrefix ? `${publicPrefix}/${encodeURIComponent(filename)}` : (process.env.R2_ENDPOINT ? `${process.env.R2_ENDPOINT}/${bucket}/${encodeURIComponent(filename)}` : null);
  return { uploadURL: signed, url, key: filename };
}

// Create signed GET URL for reading/downloading files from R2
async function createSignedGetUrlR2(key, opts = {}) {
  const client = getR2Client();
  if (!client || !getSignedUrl || !GetObjectCommand) return null;
  const bucket = process.env.R2_BUCKET;
  const expires = opts.expires || 3600; // 1 hour default for read URLs
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const signed = await getSignedUrl(client, cmd, { expiresIn: expires });
  return { url: signed, key };
}

// Create signed upload URL without uploading bytes. Returns the create response
async function createSignedUrl(filename, opts = {}) {
  const rwToken = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  // See note above: default to not enforcing remote uploads so environments without
  // blob tokens gracefully fall back to local storage or public prefix handling.
  const enforce = (process.env.ENFORCE_REMOTE_UPLOADS || 'false') === 'true';
  // If R2 is configured and SDK available, prefer R2 signed URL flows
  try {
    const r2Signed = await createSignedUrlR2(filename, opts);
    if (r2Signed) return r2Signed;
  } catch (e) {
    // ignore and fall back to Vercel flow
  }

  if (!rwToken) {
    const msg = 'No read/write token available to create signed upload URL';
    if (enforce) throw new Error(msg);
    // fallback: return public prefix URL if available
    const publicPrefix = process.env.VERCEL_BLOB_PUBLIC_URL_PREFIX;
    if (publicPrefix) {
      const prefix = publicPrefix.replace(/\/+$/, '');
      const encoded = encodeURIComponent(filename);
      return { uploadURL: null, url: `${prefix}/${encoded}`, key: filename, fallback: true };
    }
    return { uploadURL: null, url: `/uploads/${filename}`, key: `uploads/${filename}`, fallback: true };
  }

  const createUrl = 'https://api.vercel.com/v1/blob';
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${rwToken}`
    },
    body: JSON.stringify({ name: filename })
  });
  if (!createRes.ok) {
    const txt = await createRes.text().catch(()=>'<no body>');
    const msg = `Failed to create signed upload URL: ${createRes.status} ${txt}`;
    if (enforce) throw new Error(msg);
    const publicPrefix = process.env.VERCEL_BLOB_PUBLIC_URL_PREFIX;
    if (publicPrefix) {
      const prefix = publicPrefix.replace(/\/+$/, '');
      const encoded = encodeURIComponent(filename);
      return { uploadURL: null, url: `${prefix}/${encoded}`, key: filename, fallback: true };
    }
    return { uploadURL: null, url: `/uploads/${filename}`, key: `uploads/${filename}`, fallback: true };
  }
  const createBody = await createRes.json().catch(() => null);
  return createBody || {};
}

module.exports = {
  async save({ filename, buffer, contentType, uploadUrl, publicPrefix }) {
    let provider = process.env.BLOB_PROVIDER || 'local';
    // Auto-detect R2 if credentials present
    const hasR2 = process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET;
    if (hasR2) provider = 'r2';
    // If a read/write token exists, prefer remote provider (vercel) unless R2 selected
    const rwToken = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
    if (rwToken && provider === 'local') provider = 'vercel';

    if (provider === 'r2') {
      return saveR2(filename, buffer, { contentType, uploadUrl, publicPrefix });
    }
    if (provider === 'vercel' || provider === 'remote') {
      return saveRemote(filename, buffer, { contentType, uploadUrl, publicPrefix });
    }
    return saveLocal(filename, buffer);
  }
};

// Also export createSignedUrl
module.exports.createSignedUrl = createSignedUrl;

// Export createSignedGetUrl for generating signed GET URLs (for reading/downloading files)
module.exports.createSignedGetUrl = async function createSignedGetUrl(key, opts = {}) {
  // Try R2 signed GET URL first
  try {
    const r2Signed = await createSignedGetUrlR2(key, opts);
    if (r2Signed) return r2Signed;
  } catch (e) {
    console.warn('createSignedGetUrlR2 failed', e && e.message);
  }
  // Fallback: return null or public URL if configured
  const publicPrefix = process.env.R2_PUBLIC_URL_PREFIX;
  if (publicPrefix) {
    return { url: `${publicPrefix}/${encodeURIComponent(key)}`, key };
  }
  return null;
};

// Delete a blob by key or URL. Best-effort: attempt provider delete if token exists, otherwise delete local file if present.
module.exports.delete = async function deleteBlob({ key, url }) {
  const rwToken = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  // Try provider delete if key and token available
  // Try R2 delete if configured
  const hasR2 = process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET;
  if (hasR2 && key) {
    const client = getR2Client();
    if (client && DeleteObjectCommand) {
      try {
        const bucket = process.env.R2_BUCKET;
        const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: key });
        await client.send(cmd);
        return true;
      } catch (e) {
        console.warn('R2 delete failed', e && e.message);
      }
    }
  }

  // Try provider delete if key and token available (Vercel)
  if (rwToken && key) {
    // Try a Vercel delete endpoint (best-effort). The API may differ by account; handle non-OK responses silently.
    try {
      const delUrl = `https://api.vercel.com/v1/blob/${encodeURIComponent(key)}`;
      const res = await fetch(delUrl, { method: 'DELETE', headers: { authorization: `Bearer ${rwToken}` } });
      if (res.ok) return true;
      const txt = await res.text().catch(() => '');
      console.warn('vercel blob delete responded', res.status, txt);
    } catch (e) {
      console.warn('vercel blob delete failed', e && e.message);
    }
  }

  // Fallback: if URL references local uploads, delete the local file
  try {
    if (url && url.startsWith('/uploads/')) {
      const localPath = path.join(process.cwd(), 'public', url.replace(/^\//, ''));
      if (fs.existsSync(localPath)) {
        await fs.promises.unlink(localPath);
        return true;
      }
    }
  } catch (e) {
    console.warn('local blob delete failed', e && e.message);
  }

  return false;
};

// Expose helper to fetch an object from R2 (returns AWS SDK GetObject response)
module.exports.getObject = async function getObject(key) {
  const client = getR2Client();
  if (!client || !GetObjectCommand) throw new Error('R2 client not configured or SDK missing');
  const bucket = process.env.R2_BUCKET;
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const res = await client.send(cmd);
  return res;
};
