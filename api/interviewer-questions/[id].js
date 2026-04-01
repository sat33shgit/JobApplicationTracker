const db = require('../db');
const { getNumericIdFromUrl, parseRequestBody } = require('../request-utils');

async function getQuestion(_req, res, id) {
  try {
    const result = await db.query(
      'SELECT id, question, company, role, created_at, updated_at FROM interviewer_questions WHERE id = $1 LIMIT 1',
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('getInterviewerQuestion error', err?.message);
    res.status(500).json({ error: 'Failed to fetch interviewer question' });
  }
}

async function updateQuestion(req, res, id) {
  try {
    const body = parseRequestBody(req.body);
    const { question, company, role } = body || {};
    if (!question || !question.trim()) return res.status(400).json({ error: 'question is required' });
    const params = [question.trim(), (company || null), (role || null), id];
    const result = await db.query(
      'UPDATE interviewer_questions SET question = $1, company = $2, role = $3 WHERE id = $4 RETURNING id, question, company, role, created_at, updated_at',
      params
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('updateInterviewerQuestion error', err?.message);
    res.status(500).json({ error: 'Failed to update interviewer question' });
  }
}

async function deleteQuestion(_req, res, id) {
  try {
    await db.query('DELETE FROM interviewer_questions WHERE id = $1', [id]);
    res.status(204).end();
  } catch (err) {
    console.error('deleteInterviewerQuestion error', err?.message);
    res.status(500).json({ error: 'Failed to delete interviewer question' });
  }
}

module.exports = async (req, res) => {
  const id = getNumericIdFromUrl(req.url);
  if (!id) return res.status(400).json({ error: 'id required' });

  if (req.method === 'GET') return getQuestion(req, res, id);
  if (req.method === 'PUT' || req.method === 'PATCH') return updateQuestion(req, res, id);
  if (req.method === 'DELETE') return deleteQuestion(req, res, id);

  res.setHeader('Allow', 'GET, PUT, PATCH, DELETE');
  res.status(405).end('Method Not Allowed');
};
