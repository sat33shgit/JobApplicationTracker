const db = require('../db');
const { parseRequestBody } = require('../request-utils');

async function listQuestions(_req, res) {
  try {
    const result = await db.query(
      'SELECT id, question, company, role, created_at, updated_at FROM interviewer_questions ORDER BY created_at DESC'
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('listInterviewerQuestions error', err?.message);
    res.status(500).json({ error: 'Failed to list interviewer questions' });
  }
}

async function createQuestion(req, res) {
  try {
    const body = parseRequestBody(req.body);
    const { question, company, role } = body || {};
    if (!question || !question.trim()) return res.status(400).json({ error: 'question is required' });
    const params = [question.trim(), (company || null), (role || null)];
    const result = await db.query(
      'INSERT INTO interviewer_questions(question, company, role) VALUES($1,$2,$3) RETURNING id, question, company, role, created_at, updated_at',
      params
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createInterviewerQuestion error', err?.message);
    res.status(500).json({ error: 'Failed to create interviewer question' });
  }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') return listQuestions(req, res);
  if (req.method === 'POST') return createQuestion(req, res);
  res.setHeader('Allow', 'GET, POST');
  res.status(405).end('Method Not Allowed');
};
