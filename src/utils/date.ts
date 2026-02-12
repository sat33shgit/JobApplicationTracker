export function normalizeDateToInput(value?: string | Date | number | null): string {
  if (value === undefined || value === null || value === '') {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // If value is a YYYY-MM-DD string, return it as-is (it's already normalized)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // If value is a string that includes a time or timezone (ISO), parse it and use
  // UTC date parts to avoid local timezone shifts when the server provides UTC datetimes.
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getUTCFullYear();
      const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      const day = String(parsed.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    // fall through to fallback handling below
  }

  // For Date objects or numeric timestamps, use local date parts (these are already concrete moments)
  const d = new Date(value as any);
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    const y = fallback.getFullYear();
    const m = String(fallback.getMonth() + 1).padStart(2, '0');
    const day = String(fallback.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getTodayISO(): string {
  return normalizeDateToInput(new Date());
}
