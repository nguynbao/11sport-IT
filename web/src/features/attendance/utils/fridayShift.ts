export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addLocalDays(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toLocalDateStr(new Date(y, m - 1, d + days));
}

export function getNextMondayLocalStr() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay();
  const offsetToCurrentMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offsetToCurrentMonday + 7);
  return toLocalDateStr(d);
}

export const DAY_NAMES = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];
