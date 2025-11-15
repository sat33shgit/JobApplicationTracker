const { Pool } = require('pg');

// Reuse pool across lambda invocations
const connectionString = process.env.DATABASE_URL || process.env.VERCEL_POSTGRES_URL || process.env.VERCEL_PG_CONNECTION_STRING;
if (!connectionString) {
  console.warn('No DATABASE_URL or VERCEL_POSTGRES_URL found in env — API will fail until configured.');
}

const globalAny = global;
if (!globalAny.__pgPool) {
  globalAny.__pgPool = new Pool({ connectionString });
}

const pool = globalAny.__pgPool;

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
