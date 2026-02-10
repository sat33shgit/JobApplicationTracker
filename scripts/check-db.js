const fs = require('fs');
const path = require('path');

function loadEnvManual(file) {
  if (!fs.existsSync(file)) return;
  const contents = fs.readFileSync(file, 'utf8');
  contents.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  });
}

loadEnvManual(path.join(__dirname, '..', '.env.local'));

(async () => {
  try {
    const db = require('../api/db');
    console.info('db.pool present?', !!db.pool);
    const res = await db.query('SELECT 1');
    console.info('SELECT 1 result:', res.rows);
  } catch (e) {
    console.error('DB_TEST_ERROR', e && e.message, e);
    process.exitCode = 1;
  }
})();
