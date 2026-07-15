const blob = require('../lib/server/blob');
const { isSafeStorageKey } = require('../lib/server/request-utils');

const isProd = process.env.NODE_ENV === 'production';

// Content types that are safe to render inline. Anything else (notably
// text/html and image/svg+xml, which can execute scripts) is forced to
// download as an attachment to prevent stored XSS from uploaded files.
const INLINE_SAFE = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'text/plain',
]);

module.exports = async function (req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const key = req.query && (req.query.key || req.query.k) || req.url && (new URL(req.url, 'http://localhost')).searchParams.get('key');
    if (!key) return res.status(400).json({ error: 'key query parameter required' });
    if (!isSafeStorageKey(key)) return res.status(400).json({ error: 'invalid key' });

    // Fetch object from R2
    let obj;
    try {
      obj = await blob.getObject(key);
    } catch (err) {
      console.error('blob.getObject failed', err && err.message);
      return res.status(502).json({ error: 'failed to fetch object' });
    }

    // Set content-type and disposition
    const contentType = String(obj.ContentType || obj.Content_Type || 'application/octet-stream').split(';')[0].trim().toLowerCase();
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Uploaded objects are immutable per key — let the browser cache them
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (obj.ContentLength) res.setHeader('Content-Length', String(obj.ContentLength));
    // Sanitize filename to prevent HTTP header injection (strip CR/LF/quotes/control chars)
    const rawName = (key || '').split('/').pop() || 'file';
    const filename = rawName.replace(/[^a-zA-Z0-9._ ()\-]/g, "_") || "file";
    const disposition = INLINE_SAFE.has(contentType) ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);

    const body = obj.Body;
    if (body && typeof body.pipe === 'function') {
      // Stream directly
      return body.pipe(res);
    }

    // If Body isn't stream, try to collect and send
    const chunks = [];
    for await (const chunk of body) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    res.end(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'proxy failed' });
  }
};
