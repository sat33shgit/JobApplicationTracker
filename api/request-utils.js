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

module.exports = {
  getNumericIdFromUrl,
  parseRequestBody,
};
