// Small text utilities shared across components
export function normalizeNewlines(s: string): string {
  if (s === undefined || s === null) return '';
  return String(s).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u2028|\u2029/g, '\n');
}

export default normalizeNewlines;
