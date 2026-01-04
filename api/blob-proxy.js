const blob = require('./blob');

module.exports = async function (req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const key = req.query && (req.query.key || req.query.k) || req.url && (new URL(req.url, 'http://localhost')).searchParams.get('key');
    if (!key) return res.status(400).json({ error: 'key query parameter required' });

    // Fetch object from R2
    let obj;
    try {
      obj = await blob.getObject(key);
    } catch (err) {
      console.error('blob.getObject failed', err && err.message);
      return res.status(502).json({ error: 'failed to fetch object', detail: err && err.message });
    }

    // Set content-type and disposition
    const contentType = obj.ContentType || obj.Content_Type || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    const filename = (key || '').split('/').pop() || 'file';
    res.setHeader('Content-Disposition', `inline; filename="${filename.replace(/\"/g, '')}"`);

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
