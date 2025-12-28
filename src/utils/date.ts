export function normalizeDateToInput(value?: string | Date | number | null): string {
  if (value === undefined || value === null || value === '') {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }

  const d = new Date(value as any);
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    return fallback.toISOString().split('T')[0];
  }
  return d.toISOString().split('T')[0];
}

export function getTodayISO(): string {
  return normalizeDateToInput(new Date());
}
