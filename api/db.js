const { Pool } = require('pg');

// Reuse pool across lambda invocations
const connectionString = process.env.DATABASE_URL || process.env.VERCEL_POSTGRES_URL || process.env.VERCEL_PG_CONNECTION_STRING;

// In-memory mock DB implementation (used as fallback)
const jobs = [];
const attachments = [];
let nextJobId = 1;
let nextAttachId = 1;
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
async function mockQuery(text, params) {
  const t = (text || '').trim();
  const tl = t.toLowerCase();

  if (tl.startsWith('select') && tl.includes('from jobs') && tl.includes('order by')) {
    const rows = jobs.slice().sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    return { rows: clone(rows), rowCount: rows.length };
  }
  if (tl.startsWith('select') && tl.includes('from jobs') && tl.includes('where') && tl.includes('id')) {
    const id = params && params[0];
    const row = jobs.find(j => j.id === Number(id));
    return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
  }
  if (tl.startsWith('insert into jobs')) {
    const [title, company, status, stage, applied_date, url, location, salary, metadata, status_notes] = params || [];
    const job = {
      id: nextJobId++,
      title: title || null,
      company: company || null,
      status: status || 'applied',
      stage: stage || null,
      applied_date: applied_date || null,
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
    const id = params && params[0];
    const idx = jobs.findIndex(j => j.id === Number(id));
    if (idx === -1) return { rows: [], rowCount: 0 };
    jobs.splice(idx, 1);
    return { rows: [], rowCount: 1 };
  }
  console.warn('Mock DB: Unhandled SQL:', text);
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
      console.warn('Postgres query failed, falling back to in-memory mock DB:', e && e.message);
      return mockQuery(text, params);
    }
  }

  module.exports = { query, pool };

} else {
  console.warn('No DATABASE_URL or VERCEL_POSTGRES_URL found in env — using in-memory mock DB for dev.');
  module.exports = { query: mockQuery, pool: null };
}
