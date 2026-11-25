import { addDaysToDateStr, toLocalDateStr } from '../../shared/date';

export const HANDOVER_MANAGER_ROLES = new Set(['CEO', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'HR']);

export function isHandoverManagerRole(role?: string): boolean {
  return Boolean(role && HANDOVER_MANAGER_ROLES.has(String(role).toUpperCase()));
}

export function isSalesStaffUser(user?: { role?: string; department?: string } | null): boolean {
  if (!user) return false;
  return (
    String(user.role || '').toUpperCase() === 'SALES' ||
    String(user.department || '').toUpperCase() === 'SALES'
  );
}

export function stripVnAccents(str: string): string {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function isRacketCategory(code?: string, name?: string): boolean {
  const c = stripVnAccents(code || '');
  const n = stripVnAccents(name || '');
  if (c === 'vot' || c.startsWith('vot_')) return true;
  if (/\b(phu\s*kien|bao\s*ve|dan\s*vien|cuon\s*can|ve\s*sinh|chi\s*dan)\b/.test(n)) {
    return false;
  }
  return /\b(vot|paddle|racket)\b/.test(n);
}

export function buildDeterministicPermutation(n: number, cycleSeed: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  if (n <= 1) return arr;
  let state = (Math.imul(cycleSeed + 1, 0x9e3779b1) ^ 0x85ebca6b) >>> 0;
  const nextRand = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function pickDailyCompanionIndex(dateStr: string, count: number): number {
  if (count <= 1) return 0;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(y || 2026, (m || 1) - 1, d || 1) / 86400000);
  const cycle = Math.floor(dayNumber / count);
  const posInCycle = ((dayNumber % count) + count) % count;

  const perm = buildDeterministicPermutation(count, cycle);
  const prevPerm = buildDeterministicPermutation(count, cycle - 1);
  if (perm[0] === prevPerm[count - 1]) {
    const tmp = perm[0];
    perm[0] = perm[1];
    perm[1] = tmp;
  }
  return perm[posInCycle];
}

/**
 * Tìm đúng phiếu bàn giao ca đang chờ (`PENDING`) áp dụng cho nhân viên `userId` và ca nhận `receivingShiftCode`.
 */
export function resolvePendingIncomingHandoverForSales(params: {
  allHandovers: any[];
  userId: string;
  todayLocal?: string;
  receivingShiftCode?: 'SHIFT_1' | 'SHIFT_2' | 'BOTH' | null;
}): any | null {
  const {
    allHandovers,
    userId,
    todayLocal = toLocalDateStr(),
    receivingShiftCode = null,
  } = params;
  const todayUtc = new Date().toISOString().slice(0, 10);
  const todaySet = new Set([todayLocal, todayUtc]);
  const yesterdayLocal = addDaysToDateStr(todayLocal, -1);
  const yesterdayUtc = addDaysToDateStr(todayUtc, -1);
  const yesterdaySet = new Set([yesterdayLocal, yesterdayUtc]);

  const submittedHandoversToday = allHandovers.filter(
    (h) => h.status !== 'DRAFT' && todaySet.has(String(h.date))
  );
  const hasAnyHandoverToday = submittedHandoversToday.length > 0;
  const latestClosingTodayMs = submittedHandoversToday
    .filter((h) => h.shiftCode === 'SHIFT_2' || h.shiftCode === 'BOTH')
    .reduce((maxMs, h) => {
      const t = new Date(h.submittedAt || h.updatedAt || h.createdAt || 0).getTime();
      return t > maxMs ? t : maxMs;
    }, 0);

  return (
    allHandovers
      .filter((h) => {
        if (h.status !== 'PENDING') return false;
        if (String(h.fromStaffId) === String(userId)) return false;
        if (h.toStaffId && String(h.toStaffId) !== String(userId)) return false;

        const hDate = String(h.date || '');
        const hTimeMs = new Date(h.submittedAt || h.updatedAt || h.createdAt || 0).getTime();

        if (todaySet.has(hDate)) {
          if (h.shiftCode !== 'SHIFT_1') return false;
          if (latestClosingTodayMs > 0 && latestClosingTodayMs > hTimeMs) return false;
          if (receivingShiftCode && receivingShiftCode === 'SHIFT_1') return false;
          return true;
        }

        if (yesterdaySet.has(hDate)) {
          if (h.shiftCode !== 'SHIFT_2' && h.shiftCode !== 'BOTH') return false;
          if (hasAnyHandoverToday) return false;
          if (receivingShiftCode && receivingShiftCode === 'SHIFT_2') return false;
          return true;
        }

        return false;
      })
      .sort((a, b) => {
        const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
        if (dateCmp !== 0) return dateCmp;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      })[0] || null
  );
}
