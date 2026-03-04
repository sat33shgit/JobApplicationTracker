const db = require('../db');

async function listQuestions(req, res) {
  try {
    const result = await db.query('SELECT id, question, answer, category, company, created_at, updated_at FROM interview_questions ORDER BY created_at DESC');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('listQuestions error', err && err.message);
    res.status(500).json({ error: 'Failed to list interview questions' });
  }
}

async function createQuestion(req, res) {
  try {
    const body = (req.body && typeof req.body === 'string') ? (function() { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
    const { question, answer, category, company } = body || {};
    if (!question || !question.trim()) return res.status(400).json({ error: 'question is required' });
    const params = [question.trim(), (answer || null), (category || null), (company || null)];
    const result = await db.query(
      `INSERT INTO interview_questions(question, answer, category, company) VALUES($1,$2,$3,$4) RETURNING id, question, answer, category, company, created_at, updated_at`,
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
