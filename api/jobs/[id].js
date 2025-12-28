const db = require('../db');

module.exports = async function (req, res) {
  const url = require('url');
  const parsed = url.parse(req.url || req.headers['x-original-url'] || '');
  const pathname = parsed.pathname || '';
  let id = (pathname.split('/').filter(Boolean).pop() || '').toString();
  // strip query/hash if present (e.g., "14?id=14") and decode
  id = decodeURIComponent((id || '').split('?')[0].split('#')[0]);
  if (!id) return res.status(400).json({ error: 'missing id' });

  try {
    if (req.method === 'GET') {
      const result = await db.query('SELECT * FROM jobs WHERE id = $1', [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
      return res.status(200).json(result.rows[0]);
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const fields = req.body || {};
      const allowed = ['title','company','status','stage','applied_date','url','location','salary','metadata'];

      // If status is changing, fetch existing job to compare and append to status_notes
      let existing = null;
      if ('status' in fields) {
        const ex = await db.query('SELECT * FROM jobs WHERE id = $1', [id]);
        if (ex.rowCount === 1) existing = ex.rows[0];
      }

      const sets = [];
      const values = [];
      let idx = 1;
      for (const k of allowed) if (k in fields) { sets.push(`${k}=$${idx++}`); values.push(fields[k]); }

      // If status changed, append a new status note entry
      if (existing && ('status' in fields)) {
        const prevStatus = existing.status;
        const newStatus = fields.status;
        if (String(prevStatus) !== String(newStatus)) {
            // Use date-only in DD-MMM-YYYY and place notes on the next line
            const _d = new Date();
            const dateOnly = `${String(_d.getDate()).padStart(2,'0')}-${_d.toLocaleString('en-US',{month:'short'})}-${_d.getFullYear()}`;
            // Prefer notes in incoming metadata, otherwise use existing.metadata.notes
            const noteText = (fields.metadata && fields.metadata.notes) ? fields.metadata.notes : (existing.metadata && existing.metadata.notes) ? existing.metadata.notes : '';
            const entry = `${dateOnly} | ${newStatus}\n${noteText}`;
            const updatedNotes = existing.status_notes ? `${existing.status_notes}\n---\n${entry}` : entry;
          sets.push(`status_notes=$${idx++}`);
          values.push(updatedNotes);
        }
      }

      if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
      values.push(id);
      const q = `UPDATE jobs SET ${sets.join(', ')} WHERE id=$${idx} RETURNING *`;
      const result = await db.query(q, values);
      return res.status(200).json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      // Find attachments for this job and attempt to delete stored blobs/files
      try {
        const attsRes = await db.query('SELECT * FROM attachments WHERE job_id = $1', [id]);
        const atts = attsRes.rows || [];
        // Load blob helper lazily so we don't require it for simple GETs
        let blob = null;
        try {
          blob = require('../blob');
        } catch (re) {
          // If blob helper can't be loaded, log and continue — attachments will be removed from DB.
          console.warn('blob helper load failed, skipping provider deletes', re && re.message);
        }

        if (blob && typeof blob.delete === 'function') {
          for (const a of atts) {
            try {
              await blob.delete({ key: a.storage_key || a.key, url: a.url });
            } catch (e) {
              console.warn('Failed to delete blob for attachment', a.id, e && e.message);
            }
          }
        }

        // Remove attachment rows
        await db.query('DELETE FROM attachments WHERE job_id = $1', [id]);
      } catch (e) {
        // Log full stack for troubleshooting on hosting platforms
        console.error('Failed to delete attachments for job', id, e && e.message);
        if (e && e.stack) console.error(e.stack);
      }

      try {
        await db.query('DELETE FROM jobs WHERE id=$1', [id]);
        return res.status(204).end();
      } catch (e) {
        console.error('Failed to delete job', id, e && e.message);
        if (e && e.stack) console.error(e.stack);
        return res.status(500).json({ error: 'internal error', detail: process.env.NODE_ENV === 'production' ? undefined : (e && e.message) });
      }
    }

    res.setHeader('Allow', 'GET, PUT, PATCH, DELETE');
    res.status(405).end('Method Not Allowed');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
};
