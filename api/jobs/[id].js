const db = require('../db');

module.exports = async function (req, res) {
  const id = req.url.split('/').pop();
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
      const sets = [];
      const values = [];
      let idx = 1;
      for (const k of allowed) if (k in fields) { sets.push(`${k}=$${idx++}`); values.push(fields[k]); }
      if (sets.length === 0) return res.status(400).json({ error: 'no updatable fields provided' });
      values.push(id);
      const q = `UPDATE jobs SET ${sets.join(', ')} WHERE id=$${idx} RETURNING *`;
      const result = await db.query(q, values);
      return res.status(200).json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      await db.query('DELETE FROM jobs WHERE id=$1', [id]);
      return res.status(204).end();
    }

    res.setHeader('Allow', 'GET, PUT, PATCH, DELETE');
    res.status(405).end('Method Not Allowed');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
};
