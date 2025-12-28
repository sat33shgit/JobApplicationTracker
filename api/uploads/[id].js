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

    // Otherwise redirect to stored URL (e.g., blob public URL)
    if (att.url) return res.writeHead(302, { Location: att.url }).end();

    res.status(404).json({ error: 'no file URL available' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
};
