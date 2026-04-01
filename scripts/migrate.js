const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

async function run() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter((name) => /^\d+.*\.sql$/i.test(name))
    .sort();
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
    console.info(`Connected to DB, running ${migrationFiles.length} migration(s)...`);
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.info(`Applying ${file}...`);
      await client.query(sql);
    }
    console.info('Migrations applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) run();
