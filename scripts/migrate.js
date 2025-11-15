const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '001_init.sql'), 'utf8');
  let connectionString = process.env.DATABASE_URL || process.env.VERCEL_POSTGRES_URL;
  // If no env var is set, try loading from a local .env.local file (development convenience)
  if (!connectionString) {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
      const envRaw = fs.readFileSync(envPath, 'utf8');
      const match = envRaw.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/m);
      if (match) connectionString = match[1].trim();
    }
  }
  if (!connectionString) {
    console.error('Set DATABASE_URL (or VERCEL_POSTGRES_URL) env var before running migrations.');
    process.exit(1);
  }
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to DB, running migration...');
    await client.query(sql);
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) run();
