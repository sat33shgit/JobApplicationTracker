const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Load local env files if present so DATABASE_URL is available to the dev server
try {
  const dotenv = require('dotenv');
  const envPathLocal = path.join(__dirname, '.env.local');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPathLocal)) {
    dotenv.config({ path: envPathLocal });
  }
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
} catch (e) {
  // dotenv not installed — attempt simple manual .env.local parse as a fallback
  try {
    const envPathLocal = path.join(__dirname, '.env.local');
    if (fs.existsSync(envPathLocal)) {
      const contents = fs.readFileSync(envPathLocal, 'utf8');
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
        // Always set/overwrite from local .env so local config takes precedence during dev
        process.env[key] = val;
      });
      // loaded env from .env.local (manual)
    }
  } catch (err) {
    // ignore
  }
}

if (process.env.DATABASE_URL) {
  // database configured for dev
} else if (process.env.VERCEL_POSTGRES_URL) {
  // vercel postgres configured for dev
} else {
  // using in-memory mock DB for dev
}

const API_ROOT = path.join(__dirname, 'api');

function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      if (!data) return resolve(null);
      try {
        const ct = (req.headers['content-type'] || '').split(';')[0];
        if (ct === 'application/json' || ct === 'application/json;charset=UTF-8'.toLowerCase()) {
          resolve(JSON.parse(data));
        } else {
          // fallback: try JSON parse
          try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
        }
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function makeRes(originalRes) {
  const res = originalRes;
  res.status = function(code) { res.statusCode = code; return res; };
  res.json = function(obj) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
  };
  return res;
}

async function routeApi(req, res) {
  const parsed = url.parse(req.url || req.headers['x-original-url'] || '', true);
  const pathname = parsed.pathname || '/';
  // Only handle /api/*
  if (!pathname.startsWith('/api/')) return false;

  // Map to files in api/ directory
  const parts = pathname.split('/').filter(Boolean); // ['api','jobs', ...]
  const resource = parts[1];
  const id = parts[2];

  try {
    // Attach body parsing
    const body = await parseJSONBody(req).catch(err => {
      if (process.env.NODE_ENV !== 'production') console.error('body parse error', err);
      return null;
    });

    // Build adapter request and response
    const adapterReq = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body
    };

    const adapterRes = makeRes(res);

    if (resource === 'jobs') {
      if (!id) {
        // use api/jobs/index.js
        const handlerPath = path.join(API_ROOT, 'jobs', 'index.js');
        if (!fs.existsSync(handlerPath)) return false;
        if (require.cache[handlerPath]) delete require.cache[handlerPath];
        const dbPath = path.join(API_ROOT, 'db.js');
        if (fs.existsSync(dbPath) && require.cache[dbPath]) delete require.cache[dbPath];
        delete require.cache[require.resolve(handlerPath)];
        if (fs.existsSync(dbPath)) try { delete require.cache[require.resolve(dbPath)]; } catch (e) {}
        const handler = require(handlerPath);
        await handler(adapterReq, adapterRes);
        return true;
      } else {
        // Prefer explicit handler file (e.g., api/jobs/create.js) over generic [id].js
        const explicitHandler = path.join(API_ROOT, 'jobs', `${id}.js`);
        const genericHandler = path.join(API_ROOT, 'jobs', '[id].js');
        let handlerPath = null;
        if (fs.existsSync(explicitHandler)) handlerPath = explicitHandler;
        else if (fs.existsSync(genericHandler)) handlerPath = genericHandler;
        else return false;

        if (require.cache[handlerPath]) delete require.cache[handlerPath];
        const dbPath = path.join(API_ROOT, 'db.js');
        if (fs.existsSync(dbPath) && require.cache[dbPath]) delete require.cache[dbPath];
        delete require.cache[require.resolve(handlerPath)];
        if (fs.existsSync(dbPath)) try { delete require.cache[require.resolve(dbPath)]; } catch (e) {}
        // ensure req.url is full path so handler can parse id
        adapterReq.url = pathname;
        const handler = require(handlerPath);
        await handler(adapterReq, adapterRes);
        return true;
      }
    }

    if (resource === 'uploads') {
      if (!id) {
        const handlerPath = path.join(API_ROOT, 'uploads', 'index.js');
        if (!fs.existsSync(handlerPath)) return false;
        if (require.cache[handlerPath]) delete require.cache[handlerPath];
        const dbPath = path.join(API_ROOT, 'db.js');
        const blobPath = path.join(API_ROOT, 'blob.js');
        if (fs.existsSync(dbPath) && require.cache[dbPath]) delete require.cache[dbPath];
        if (fs.existsSync(blobPath) && require.cache[blobPath]) delete require.cache[blobPath];
        delete require.cache[require.resolve(handlerPath)];
        if (fs.existsSync(dbPath)) try { delete require.cache[require.resolve(dbPath)]; } catch (e) {}
        if (fs.existsSync(blobPath)) try { delete require.cache[require.resolve(blobPath)]; } catch (e) {}
        const handler = require(handlerPath);
        await handler(adapterReq, adapterRes);
        return true;
      } else {
        // Prefer explicit handler file (e.g., api/uploads/create.js) over generic [id].js
        const explicitHandler = path.join(API_ROOT, 'uploads', `${id}.js`);
        const genericHandler = path.join(API_ROOT, 'uploads', '[id].js');
        let handlerPath = null;
        if (fs.existsSync(explicitHandler)) handlerPath = explicitHandler;
        else if (fs.existsSync(genericHandler)) handlerPath = genericHandler;
        else return false;

        if (require.cache[handlerPath]) delete require.cache[handlerPath];
        const dbPath = path.join(API_ROOT, 'db.js');
        const blobPath = path.join(API_ROOT, 'blob.js');
        if (fs.existsSync(dbPath) && require.cache[dbPath]) delete require.cache[dbPath];
        if (fs.existsSync(blobPath) && require.cache[blobPath]) delete require.cache[blobPath];
        delete require.cache[require.resolve(handlerPath)];
        if (fs.existsSync(dbPath)) try { delete require.cache[require.resolve(dbPath)]; } catch (e) {}
        if (fs.existsSync(blobPath)) try { delete require.cache[require.resolve(blobPath)]; } catch (e) {}
        adapterReq.url = pathname;
        const handler = require(handlerPath);
        await handler(adapterReq, adapterRes);
        return true;
      }
    }

    // other api resources can be added similarly
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('API handler error', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'internal server error' }));
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  // Simple CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();

  const handled = await routeApi(req, res);
  if (handled) return;

  // Not an API route
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Not Found' }));
});

const PORT = process.env.DEV_API_PORT || 3002;
server.listen(PORT);
