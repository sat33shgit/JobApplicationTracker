const http = require('node:http');
const url = require('node:url');
const fs = require('node:fs');
const path = require('node:path');

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
} catch (_e) {
  // dotenv not installed — attempt simple manual .env.local parse as a fallback
  try {
    const envPathLocal = path.join(__dirname, '.env.local');
    if (fs.existsSync(envPathLocal)) {
      const contents = fs.readFileSync(envPathLocal, 'utf8');
      for (const line of contents.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        // Always set/overwrite from local .env so local config takes precedence during dev
        process.env[key] = val;
      }
      // loaded env from .env.local (manual)
    }
  } catch (_err) {
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
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve(null);
      try {
        const ct = (req.headers['content-type'] || '').split(';')[0];
        if (ct === 'application/json' || ct === 'application/json;charset=UTF-8'.toLowerCase()) {
          resolve(JSON.parse(data));
        } else {
          // fallback: try JSON parse
          try {
            resolve(JSON.parse(data));
          } catch (_e) {
            resolve(data);
          }
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
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
  };
  return res;
}

function clearModuleCache(modulePath) {
  if (!fs.existsSync(modulePath)) return;
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_error) {
    // ignore cache misses during local reloads
  }
}

function getHandlerPath(resource, id) {
  const resourceDir = path.join(API_ROOT, resource);
  if (!fs.existsSync(resourceDir)) return null;
  if (!id) return path.join(resourceDir, 'index.js');

  const explicitHandler = path.join(resourceDir, `${id}.js`);
  const genericHandler = path.join(resourceDir, '[id].js');
  if (fs.existsSync(explicitHandler)) return explicitHandler;
  if (fs.existsSync(genericHandler)) return genericHandler;
  return null;
}

async function handleApiResource(resource, id, pathname, adapterReq, adapterRes, dependencies = ['db.js']) {
  const handlerPath = getHandlerPath(resource, id);
  if (!handlerPath || !fs.existsSync(handlerPath)) return false;

  clearModuleCache(handlerPath);
  for (const dependency of dependencies) {
    clearModuleCache(path.join(API_ROOT, dependency));
  }

  if (id) adapterReq.url = pathname;
  const handler = require(handlerPath);
  await handler(adapterReq, adapterRes);
  return true;
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

    if (resource === 'jobs') return handleApiResource(resource, id, pathname, adapterReq, adapterRes);

    if (resource === 'uploads') {
      return handleApiResource(resource, id, pathname, adapterReq, adapterRes, ['db.js', 'blob.js']);
    }

    if (resource === 'interview-questions') {
      return handleApiResource(resource, id, pathname, adapterReq, adapterRes);
    }

    if (resource === 'interviewer-questions') {
      return handleApiResource(resource, id, pathname, adapterReq, adapterRes);
    }

    // other api resources can be added similarly
  } catch (_err) {
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
