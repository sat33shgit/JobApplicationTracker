const db = require('../db');

async function listQuestions(req, res) {
  try {
    const result = await db.query('SELECT id, question, answer, category, created_at, updated_at FROM interview_questions ORDER BY created_at DESC');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('listQuestions error', err && err.message);
    res.status(500).json({ error: 'Failed to list interview questions' });
  }
}

async function createQuestion(req, res) {
  try {
    const { question, answer, category } = req.body || {};
    if (!question || !question.trim()) return res.status(400).json({ error: 'question is required' });
    const params = [question.trim(), (answer || null), (category || null)];
    const result = await db.query(
      `INSERT INTO interview_questions(question, answer, category) VALUES($1,$2,$3) RETURNING id, question, answer, category, created_at, updated_at`,
      params
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createQuestion error', err && err.message);
    res.status(500).json({ error: 'Failed to create interview question' });
  }
}

module.exports = async function (req, res) {
  if (req.method === 'GET') return listQuestions(req, res);
  if (req.method === 'POST') return createQuestion(req, res);
  res.setHeader('Allow', 'GET, POST');
  res.status(405).end('Method Not Allowed');
};
