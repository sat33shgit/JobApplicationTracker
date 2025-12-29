const blob = require('../blob');

module.exports = async function (req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { filename, contentType } = req.body;
    if (!filename) return res.status(400).json({ error: 'filename required' });

    // ask blob helper to create a signed upload URL (this delegates to Vercel API)
    if (typeof blob.createSignedUrl !== 'function') {
      return res.status(501).json({ error: 'server does not support signed upload creation' });
    }

    try {
      // blob.createSignedUrl expects (filename, opts)
      const createRes = (await blob.createSignedUrl(filename, { contentType })) || {};

      // If Cloudflare R2 is configured on the server, do not return the signed
      // upload URL to the browser (it will often fail due to CORS). Instead,
      // force server-side upload by omitting uploadURL fields. The server-side
      // upload path (`/api/uploads` POST with `contentBase64`) will then be used.
      const hasR2 = process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET;
      if (hasR2) {
        delete createRes.uploadURL;
        delete createRes.uploadUrl;
        delete createRes.signedUrl;
      }

      return res.status(200).json(createRes);
    } catch (err) {
      console.error('create upload url failed', err && err.message);
      if (err && err.stack) console.error(err.stack);
      // Surface error details to client to aid debugging (do not include secrets)
      return res.status(502).json({ error: 'failed to create upload url', detail: err && err.message });
    }
  } catch (err) {
    console.error('create upload url failed', err && err.message);
    res.status(500).json({ error: 'failed to create upload url' });
  }
};
