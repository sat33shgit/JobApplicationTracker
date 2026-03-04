const db = require('../db');

async function getQuestion(req, res, id) {
  try {
    const result = await db.query('SELECT id, question, answer, category, company, created_at, updated_at FROM interview_questions WHERE id = $1 LIMIT 1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('getQuestion error', err && err.message);
    res.status(500).json({ error: 'Failed to fetch interview question' });
  }
}

async function updateQuestion(req, res, id) {
  try {
    const body = (req.body && typeof req.body === 'string') ? (function() { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
    const { question, answer, category, company } = body || {};
    if (!question || !question.trim()) return res.status(400).json({ error: 'question is required' });
    const params = [question.trim(), (answer || null), (category || null), (company || null), id];
    const result = await db.query(
      `UPDATE interview_questions SET question = $1, answer = $2, category = $3, company = $4 WHERE id = $5 RETURNING id, question, answer, category, company, created_at, updated_at`,
      params
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('updateQuestion error', err && err.message);
    res.status(500).json({ error: 'Failed to update interview question' });
  }
}

async function deleteQuestion(req, res, id) {
  try {
    const result = await db.query('DELETE FROM interview_questions WHERE id = $1', [id]);
    res.status(204).end();
  } catch (err) {
    console.error('deleteQuestion error', err && err.message);
    res.status(500).json({ error: 'Failed to delete interview question' });
  }
}

module.exports = async function (req, res) {
  // derive id from URL (dev-server sets adapterReq.url to pathname)
  const parts = (req.url || '').split('/').filter(Boolean);
  const idPart = parts[2];
  const id = idPart ? Number(idPart) : null;
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method === 'GET') return getQuestion(req, res, id);
  if (req.method === 'PUT' || req.method === 'PATCH') return updateQuestion(req, res, id);
  if (req.method === 'DELETE') return deleteQuestion(req, res, id);

  res.setHeader('Allow', 'GET, PUT, PATCH, DELETE');
  res.status(405).end('Method Not Allowed');
};
