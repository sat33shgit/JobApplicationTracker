function parseRequestBody(body) {
  if (!body) return {};
  if (typeof body !== 'string') return body;

  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function getNumericIdFromUrl(requestUrl) {
  const parts = String(requestUrl || '').split('/').filter(Boolean);
  const idPart = parts[2] || '';
  const match = idPart.match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

// Sanitize a user-supplied filename: keep only the base name and strip
// characters that enable path traversal or header injection.
function sanitizeFilename(name) {
  const base = String(name || '')
    .replace(/[\r\n\0]/g, '')
    .split(/[\\/]/)
    .pop() || '';
  const cleaned = base.replace(/[^a-zA-Z0-9._ ()\-]/g, '_').replace(/\.{2,}/g, '.').trim();
  return cleaned && cleaned !== '.' ? cleaned : null;
}

// Validate a storage key (may contain path segments, but no traversal or absolute paths).
function isSafeStorageKey(key) {
  const k = String(key || '');
  if (!k || k.length > 512) return false;
  if (k.startsWith('/') || k.includes('\\') || k.includes('\0')) return false;
  if (k.split('/').some(seg => seg === '' || seg === '.' || seg === '..')) return false;
  return true;
}

module.exports = {
  getNumericIdFromUrl,
  parseRequestBody,
  sanitizeFilename,
  isSafeStorageKey,
};
