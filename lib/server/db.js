const { Pool } = require('pg');

// Reuse pool across lambda invocations
const connectionString = process.env.DATABASE_URL || process.env.VERCEL_POSTGRES_URL || process.env.VERCEL_PG_CONNECTION_STRING;

// In-memory mock DB implementation (used as fallback)
const jobs = [];
const attachments = [];
let nextJobId = 1;
let nextAttachId = 1;

function getMockInterviewQuestions() {
  if (!global.__mock_interview_questions) global.__mock_interview_questions = [];
  if (!global.__mock_interview_questions_next_id) global.__mock_interview_questions_next_id = 1;
  return global.__mock_interview_questions;
}

function getMockInterviewerQuestions() {
  if (!global.__mock_interviewer_questions) global.__mock_interviewer_questions = [];
  if (!global.__mock_interviewer_questions_next_id) global.__mock_interviewer_questions_next_id = 1;
  return global.__mock_interviewer_questions;
}

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
async function mockQuery(text, params) {
  const t = (text || '').trim();
  const tl = t.toLowerCase();

  if (tl.startsWith('select') && tl.includes('from jobs') && tl.includes('order by')) {
    const rows = jobs.slice().sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    return { rows: clone(rows), rowCount: rows.length };
  }
  if (tl.startsWith('select') && tl.includes('from jobs') && tl.includes('where') && tl.includes('id')) {
    const id = params?.[0];
    const row = jobs.find(j => j.id === Number(id));
    return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
  }
  if (tl.startsWith('insert into jobs')) {
    const [
      title,
      company,
      status,
      stage,
      applied_date,
      interview_date,
      interview_sub_status,
      url,
      location,
      salary,
      metadata,
      status_notes,
    ] = params || [];
    const job = {
      id: nextJobId++,
      title: title || null,
      company: company || null,
      status: status || 'applied',
      stage: stage || null,
      applied_date: applied_date || null,
      interview_date: interview_date || null,
      interview_sub_status: interview_sub_status || null,
      url: url || null,
      location: location || null,
      salary: salary || null,
      metadata: metadata || null,
      status_notes: status_notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    jobs.push(job);
    return { rows: [clone(job)], rowCount: 1 };
  }
  if (tl.startsWith('insert into attachments')) {
    const [jobId, filename, storage_key, url, size, content_type] = params || [];
    const a = {
      id: nextAttachId++,
      job_id: jobId || null,
      filename: filename || null,
      storage_key: storage_key || null,
      url: url || null,
      size: size || null,
      content_type: content_type || null,
      created_at: new Date().toISOString(),
    };
    attachments.push(a);
    return { rows: [clone(a)], rowCount: 1 };
  }
  // Interview questions mock handling
  if (tl.startsWith('select') && tl.includes('from interview_questions') && tl.includes('order by')) {
    const rows = getMockInterviewQuestions().slice().sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    return { rows: clone(rows), rowCount: rows.length };
  }
  if (tl.startsWith('select') && tl.includes('from interview_questions') && tl.includes('where') && tl.includes('id')) {
    const id = params?.[0];
    const row = getMockInterviewQuestions().find(r => r.id === Number(id));
    return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
  }
  if (tl.startsWith('insert into interview_questions')) {
    const rows = getMockInterviewQuestions();
    const [question, answer, category, company, role] = params || [];
    const nextId = global.__mock_interview_questions_next_id;
    const row = {
      id: nextId,
      question: question || null,
      answer: answer || null,
      category: category || null,
      company: company || null,
      role: role || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    global.__mock_interview_questions_next_id = nextId + 1;
    rows.push(row);
    return { rows: [clone(row)], rowCount: 1 };
  }
  if (tl.startsWith('update interview_questions set')) {
    const m = t.match(/update\s+interview_questions\s+set\s+([\s\S]+?)\s+where\s+id\s*=\s*\$\d+/i);
    if (!m) return { rows: [], rowCount: 0 };
    const values = params || [];
    const id = values[values.length - 1];
    const row = getMockInterviewQuestions().find(r => r.id === Number(id));
    if (!row) return { rows: [], rowCount: 0 };
    row.question = values[0];
    row.answer = values[1];
    row.category = values[2];
    row.company = values[3] || null;
    row.role = values[4] || null;
    row.updated_at = new Date().toISOString();
    return { rows: [clone(row)], rowCount: 1 };
  }
  if (tl.startsWith('delete from interview_questions')) {
    const id = params?.[0];
    const rows = getMockInterviewQuestions();
    const idx = rows.findIndex(r => r.id === Number(id));
    if (idx === -1) return { rows: [], rowCount: 0 };
    rows.splice(idx, 1);
    return { rows: [], rowCount: 1 };
  }
  // Interviewer questions mock handling
  if (tl.startsWith('select') && tl.includes('from interviewer_questions') && tl.includes('order by')) {
    const rows = getMockInterviewerQuestions().slice().sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    return { rows: clone(rows), rowCount: rows.length };
  }
  if (tl.startsWith('select') && tl.includes('from interviewer_questions') && tl.includes('where') && tl.includes('id')) {
    const id = params?.[0];
    const row = getMockInterviewerQuestions().find(r => r.id === Number(id));
    return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
  }
  if (tl.startsWith('insert into interviewer_questions')) {
    const rows = getMockInterviewerQuestions();
    const [question, company, role] = params || [];
    const nextId = global.__mock_interviewer_questions_next_id;
    const row = {
      id: nextId,
      question: question || null,
      company: company || null,
      role: role || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    global.__mock_interviewer_questions_next_id = nextId + 1;
    rows.push(row);
    return { rows: [clone(row)], rowCount: 1 };
  }
  if (tl.startsWith('update interviewer_questions set')) {
    const m = t.match(/update\s+interviewer_questions\s+set\s+([\s\S]+?)\s+where\s+id\s*=\s*\$\d+/i);
    if (!m) return { rows: [], rowCount: 0 };
    const values = params || [];
    const id = values[values.length - 1];
    const row = getMockInterviewerQuestions().find(r => r.id === Number(id));
    if (!row) return { rows: [], rowCount: 0 };
    row.question = values[0];
    row.company = values[1] || null;
    row.role = values[2] || null;
    row.updated_at = new Date().toISOString();
    return { rows: [clone(row)], rowCount: 1 };
  }
  if (tl.startsWith('delete from interviewer_questions')) {
    const id = params?.[0];
    const rows = getMockInterviewerQuestions();
    const idx = rows.findIndex(r => r.id === Number(id));
    if (idx === -1) return { rows: [], rowCount: 0 };
    rows.splice(idx, 1);
    return { rows: [], rowCount: 1 };
  }
  if (tl.startsWith('update jobs set')) {
    const m = t.match(/update\s+jobs\s+set\s+([\s\S]+?)\s+where\s+id\s*=\s*\$\d+/i);
    if (!m) return { rows: [], rowCount: 0 };
    const setPart = m[1];
    const assigns = setPart.split(',').map(s => s.trim());
    const values = params || [];
    const id = values[values.length - 1];
    const job = jobs.find(j => j.id === Number(id));
    if (!job) return { rows: [], rowCount: 0 };
    for (let i = 0; i < assigns.length; i++) {
      const am = assigns[i].match(/([a-z_0-9]+)\s*=\s*\$\d+/i);
      if (!am) continue;
      const key = am[1];
      job[key] = values[i];
    }
    job.updated_at = new Date().toISOString();
    return { rows: [clone(job)], rowCount: 1 };
  }
  if (tl.startsWith('delete from jobs')) {
    const id = params?.[0];
    const idx = jobs.findIndex(j => j.id === Number(id));
    if (idx === -1) return { rows: [], rowCount: 0 };
    jobs.splice(idx, 1);
    return { rows: [], rowCount: 1 };
  }
  if (process.env.NODE_ENV !== 'production') console.warn('Mock DB: Unhandled SQL:', text);
  return { rows: [], rowCount: 0 };
}

if (connectionString && process.env.FORCE_LOCAL_DB !== 'true') {
  const globalAny = global;
  if (!globalAny.__pgPool) {
    globalAny.__pgPool = new Pool({ connectionString });
  }
  const pool = globalAny.__pgPool;

  // Export a wrapper that attempts real DB queries and falls back to mock on connection errors
  async function query(text, params) {
    try {
      return await pool.query(text, params);
    } catch (e) {
      // If connection refused or similar, fallback to mock DB to keep local dev usable
      if (process.env.NODE_ENV !== 'production') console.warn('Postgres query failed, falling back to in-memory mock DB:', e?.message);
      return mockQuery(text, params);
    }
  }

  module.exports = { query, pool };

} else {
  if (process.env.NODE_ENV !== 'production') console.warn('No DATABASE_URL or VERCEL_POSTGRES_URL found in env — using in-memory mock DB for dev.');
  module.exports = { query: mockQuery, pool: null };
}
