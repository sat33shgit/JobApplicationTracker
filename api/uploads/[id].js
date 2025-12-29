const db = require('../db');
const path = require('path');
const fs = require('fs');

module.exports = async function (req, res) {
  const url = require('url');
  const parsed = url.parse(req.url || req.headers['x-original-url'] || '');
  const pathname = parsed.pathname || '';
  let id = (pathname.split('/').filter(Boolean).pop() || '').toString();
  id = decodeURIComponent((id || '').split('?')[0].split('#')[0]);
  if (!id) return res.status(400).json({ error: 'missing id' });

  try {
    const result = await db.query('SELECT * FROM attachments WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    const att = result.rows[0];
    // If attachment URL is a local path (/uploads/...), serve the file from public/uploads
    if (att.url && att.url.startsWith('/uploads/')) {
      const localPath = path.join(process.cwd(), 'public', att.url.replace(/^\//, ''));
      if (!fs.existsSync(localPath)) return res.status(404).json({ error: 'file not found' });
      res.setHeader('Content-Type', att.content_type || 'application/octet-stream');
      const stream = fs.createReadStream(localPath);
      return stream.pipe(res);
    }

    // If we have a storage key (R2), try to produce a signed URL and redirect to it
    if (att.storage_key) {
      try {
        const blob = require('../blob');
        if (typeof blob.createSignedUrl === 'function') {
          const signed = await blob.createSignedUrl(att.storage_key, { contentType: att.content_type });
          if (signed && signed.uploadURL) {
            // For S3 presigned PUT style we returned uploadURL; for GET signed URL some providers return URL directly.
            // If createSignedUrl returned `uploadURL` for PUT, still prefer to return a presigned GET URL if available.
            // Here, if `signed.url` is present, use it; otherwise use `signed.uploadURL` as a best-effort.
            const redirectTo = signed.url || signed.uploadURL;
            if (redirectTo) return res.writeHead(302, { Location: redirectTo }).end();
          }
        }
      } catch (e) {
        console.warn('createSignedUrl failed', e && e.message);
      }
    }

    // Otherwise redirect to stored URL (e.g., blob public URL)
    if (att.url) return res.writeHead(302, { Location: att.url }).end();

    res.status(404).json({ error: 'no file URL available' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
};
