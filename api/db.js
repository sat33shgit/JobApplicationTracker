const { Pool } = require('pg');

// Reuse pool across lambda invocations
const connectionString = process.env.DATABASE_URL || process.env.VERCEL_POSTGRES_URL || process.env.VERCEL_PG_CONNECTION_STRING;

if (connectionString) {
  const globalAny = global;
  if (!globalAny.__pgPool) {
    globalAny.__pgPool = new Pool({ connectionString });
  }
  const pool = globalAny.__pgPool;
  module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
  };

} else {
  // Fallback: in-memory mock DB for local development when no DATABASE_URL is configured.
  // This implements the minimal queries used by the API handlers (jobs + attachments).
  console.warn('No DATABASE_URL or VERCEL_POSTGRES_URL found in env — using in-memory mock DB for dev.');

  const jobs = [];
  const attachments = [];
  let nextJobId = 1;
  let nextAttachId = 1;

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  async function query(text, params) {
    const t = (text || '').trim();
    const tl = t.toLowerCase();

    // List jobs
    if (tl.startsWith('select') && tl.includes('from jobs') && tl.includes('order by')) {
      const rows = jobs.slice().sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      return { rows: clone(rows), rowCount: rows.length };
    }

    // Select job by id
    if (tl.startsWith('select') && tl.includes('from jobs') && tl.includes('where') && tl.includes('id')) {
      const id = params && params[0];
      const row = jobs.find(j => j.id === Number(id));
      return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
    }

    // Insert job
    if (tl.startsWith('insert into jobs')) {
      const [title, company, status, stage, applied_date, url, location, salary, metadata] = params || [];
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      jobs.push(job);
      return { rows: [clone(job)], rowCount: 1 };
    }

    // Insert attachment
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

    // Update jobs (expects 'UPDATE jobs SET ... WHERE id=$n RETURNING *')
    if (tl.startsWith('update jobs set')) {
      const m = t.match(/update\s+jobs\s+set\s+([\s\S]+?)\s+where\s+id\s*=\s*\$\d+/i);
      if (!m) return { rows: [], rowCount: 0 };
      const setPart = m[1];
      const assigns = setPart.split(',').map(s => s.trim());
      const values = params || [];
      const id = values[values.length - 1];
      const job = jobs.find(j => j.id === Number(id));
      if (!job) return { rows: [], rowCount: 0 };
      // map each assignment to corresponding value index
      for (let i = 0; i < assigns.length; i++) {
        const am = assigns[i].match(/([a-z_0-9]+)\s*=\s*\$\d+/i);
        if (!am) continue;
        const key = am[1];
        job[key] = values[i];
      }
      job.updated_at = new Date().toISOString();
      return { rows: [clone(job)], rowCount: 1 };
    }

    // Delete job
    if (tl.startsWith('delete from jobs')) {
      const id = params && params[0];
      const idx = jobs.findIndex(j => j.id === Number(id));
      if (idx === -1) return { rows: [], rowCount: 0 };
      jobs.splice(idx, 1);
      return { rows: [], rowCount: 1 };
    }

    // Fallback: return empty result to avoid crashing
    console.warn('Mock DB: Unhandled SQL:', text);
    return { rows: [], rowCount: 0 };
  }

  module.exports = { query, pool: null };
}
