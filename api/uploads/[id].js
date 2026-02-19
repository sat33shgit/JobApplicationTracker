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
    // Handle DELETE request - delete individual attachment
    if (req.method === 'DELETE') {
      const result = await db.query('SELECT * FROM attachments WHERE id = $1', [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
      const att = result.rows[0];

      // Try to delete from storage (R2 or local)
      let blob = null;
      try {
        blob = require('../blob');
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') console.warn('blob helper load failed, skipping storage delete', e && e.message);
      }

      if (blob && typeof blob.delete === 'function') {
        try {
          await blob.delete({ key: att.storage_key, url: att.url });
        } catch (e) {
          if (process.env.NODE_ENV !== 'production') console.warn('Failed to delete blob for attachment', att.id, e && e.message);
        }
      }

      // Delete from database
      await db.query('DELETE FROM attachments WHERE id = $1', [id]);

      // Return the deleted attachment info so client can update state
      return res.status(200).json({ deleted: true, id: att.id, job_id: att.job_id });
    }

    // Handle GET request - serve/redirect to the file
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

    // If we have a storage key (R2), try to produce a signed GET URL and redirect to it
    if (att.storage_key) {
      try {
        const blob = require('../blob');
        // Use createSignedGetUrl for reading files (not createSignedUrl which is for uploads)
        if (typeof blob.createSignedGetUrl === 'function') {
          const signed = await blob.createSignedGetUrl(att.storage_key, { contentType: att.content_type });
          if (signed && signed.url) {
            return res.writeHead(302, { Location: signed.url }).end();
          }
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') console.warn('createSignedGetUrl failed', e && e.message);
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
