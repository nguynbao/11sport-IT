function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toLocalDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseLocalDateStr(dateStr: string): Date {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDaysToDateStr(dateStr: string, daysToAdd: number): string {
  const dt = parseLocalDateStr(dateStr);
  dt.setDate(dt.getDate() + daysToAdd);
  return toLocalDateStr(dt);
}

export function diffCalendarDays(fromDateStr: string, toDateStr: string): number {
  const d1 = parseLocalDateStr(fromDateStr);
  const d2 = parseLocalDateStr(toDateStr);
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

export function getMondayOfDateStr(dateStr: string): string {
  const dt = parseLocalDateStr(dateStr);
  const day = dt.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + offset);
  return toLocalDateStr(dt);
}

export function getWeekDatesOfDateStr(dateStr: string): string[] {
  const monday = getMondayOfDateStr(dateStr);
  return Array.from({ length: 7 }, (_, i) => addDaysToDateStr(monday, i));
}

export function toYearMonthStr(val?: Date | string | null): string | null {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}/.test(val.trim())) {
    return val.trim().slice(0, 7);
  }
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function diffMonthsInclusive(startYM: string, endYM: string): number {
  const [y1, m1] = startYM.split('-').map(Number);
  const [y2, m2] = endYM.split('-').map(Number);
  if (!y1 || !m1 || !y2 || !m2) return 0;
  const diff = (y2 - y1) * 12 + (m2 - m1);
  return diff < 0 ? 0 : diff + 1;
}
