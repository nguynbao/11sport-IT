import { toLocalDateStr } from '../../shared/date';

export const SHIFT_REG_PAID_LEAVE_REASON = 'Đăng ký nghỉ phép trong lịch đăng ký ca tuần';

export function getNextMondayStr(now = new Date()): string {
  const day = now.getDay();
  const daysUntilNextMonday = day === 0 ? 1 : 8 - day;
  const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilNextMonday);
  return toLocalDateStr(dt);
}

export function getCurrentMondayStr(now = new Date()): string {
  const day = now.getDay();
  const offset = day === 0 ? 6 : day - 1;
  const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
  return toLocalDateStr(dt);
}
